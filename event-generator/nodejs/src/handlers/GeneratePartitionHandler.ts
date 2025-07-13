import { GeneratePartitionResponse, RequestHandler, IncomingMessageEnvelope, Request, GeneratePartitionRequest, MessageTrackingCollection, MessageOptionsPair, chunks, commands } from "core-lib";
import { addOffsetToCoordinates, Config, formatPoint, GpsCoordinates, KM, Logger, IMessageBus, MoveCommand, Rect, sleep, Stopwatch } from "core-lib";
import { VehiclePredicate, Engine } from "../simulation/engine.js";

export class GeneratePartitionHandler extends RequestHandler<GeneratePartitionRequest, GeneratePartitionResponse> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private generatorIndex: number,
        private messageTrackingCollection: MessageTrackingCollection,
    ) {
        super();
    }

    get description(): string {
        return `Generates the vehicle positions for a subset of the vehicles based on the configured partition key.`;
    }

    get messageTypes(): string[] {
        return ['generate-partition-request'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<GeneratePartitionRequest>>): Promise<GeneratePartitionResponse> {
        this.messageTrackingCollection.clear();
        const event = req.body.body;
        const vehicleCount = event.request.vehicleCount;
        const refreshIntervalInSecs = event.request.refreshIntervalInSecs;
        const realtime = event.request.realtime;
        const startDate = event.startDate;
        const commandMovePath = commands.move.publish({});
        const commandMove2Path = commands.move2.publish({});
        const duplicateMove = this.messageBus.features.supportsAbstractSubjects === false;
        let vehiclePredicate: VehiclePredicate | undefined;
        if (this.config.generator.instances > 1) {
            vehiclePredicate = (idx, id) => idx % this.config.generator.instances === this.generatorIndex;
        }
    
        const engine = new Engine({
            vehicleCount,
            vehicleTypes: event.request.vehicleTypes.length > 0 ? event.request.vehicleTypes : this.config.generator.vehicleTypes,
            regionBounds: new Rect(
                { 
                    x: 0, 
                    y: 0,
                },
                {
                    width:  this.config.generator.map.widthInKm * KM,
                    height: this.config.generator.map.heightInKm * KM,    
                }
            ),
            zoneSize: {
                width:  this.config.generator.zoneSize.widthInKm * KM,
                height: this.config.generator.zoneSize.heightInKm * KM,
            },
            speed: {
                min:  3 * KM,
                max: 40 * KM,
            },
            refreshIntervalInSecs,
            startDate,
            enableOscillation: true,
            vehiclePredicate,
        });
    
        const anchor: GpsCoordinates = this.config.generator.map.topLeftOrigin;
        const refreshIntervalInMS = refreshIntervalInSecs * 1000;
        let chunkSize = Math.max(req.body.body.request.messageChunkSize ?? this.config.generator.messageChunkSize, 1);
        if (duplicateMove) {
            chunkSize = Math.max(1, chunkSize / 2);
        }
        let chunksPerIteration = Math.trunc(vehicleCount / chunkSize);
        if (vehicleCount % chunkSize !== 0) {
            chunksPerIteration += 1;
        }
        const chunkWaitDelayInMS = Math.max(1, Math.round((refreshIntervalInMS / chunksPerIteration) * 0.9));
        const watch = new Stopwatch();
        watch.start();
        const useBackpressure = this.config.backpressure.enabled && 
                                req.body.body.request.useBackpressure === true;
        let eventCount = 0;
        let done = false;
        while (!done) {
            const commands = engine.execute();
            const iterationWatch = Stopwatch.startNew();
            for (const chunk of chunks(commands.values(), chunkSize)) {
                const messageBatch: MessageOptionsPair[] = [];
                for (const cmd of chunk) {
                    if (this.config.generator.logging.level === "trace") {
                        this.logger.trace(cmd.timestamp, `Vehicle #${cmd.vehicle.id} ${cmd.newState.direction} ${formatPoint(cmd.vehicle.location)} speed=${cmd.newState.speed} localBounds=${cmd.newState.localBounds.toString()}, offset=${formatPoint(cmd.newState.offset)}`);
                    }
                    const loc = cmd.vehicle.location;
                    const gpsPos = addOffsetToCoordinates(anchor, loc.x, loc.y);
                    const msg: MoveCommand = {
                        type: 'move',
                        vehicleId: cmd.vehicle.id,
                        vehicleType: cmd.vehicle.type,
                        zoneId: cmd.newState.zone.id,
                        direction: cmd.newState.direction,
                        speed: cmd.newState.speed,
                        gps: gpsPos,
                        timestamp: cmd.timestamp.toISOString(),
                    }
                    if (useBackpressure) {
                        msg.tracking = {
                            sequence: eventCount,
                            emitter: this.messageBus.identity,
                        }
                    }
                    messageBatch.push([msg, { path: commandMovePath }]);
                    if (duplicateMove) {
                        // When the MessageBus does not allow to subscribe both as a queue and as a topic for the same subject,
                        // we have to split the usage in two distinct subjects.
                        // This one will be used by the viewer to map the position of the vehicles on the display.
                        messageBatch.push([msg, { path: commandMove2Path }]);
                    }

                    eventCount++;
                    if (eventCount >= event.maxNumberOfEvents) {
                        done = true;
                        break;
                    }
                    if (req.shouldCancel === true) {
                        this.logger.warn('Sub-generator should stop immediatly!');
                        done = true;
                        break;
                    }
                }
                await this.messageBus.publishBatch(messageBatch);
                
                if (realtime) {
                    await sleep(chunkWaitDelayInMS);
                } else if (useBackpressure) {
                    await this.applyBackpressure(req, eventCount);
                } else {
                    await sleep(event.request.pauseDelayInMSecs ?? 1);
                }

                if (done) {
                    break;
                }
            }

            if (!done) {
                if (realtime) {
                    const delta = refreshIntervalInMS - iterationWatch.elapsedTimeInMS();
                    if (delta > 0) {
                        await sleep(delta);
                    }
                }
            }
        }
        if (useBackpressure) {
            this.logger.debug('Waiting for final backpressure...');
            await this.applyBackpressure(req, eventCount, true);
        }
        watch.stop();
        this.logger.info(`Done generating ${eventCount} out of ${event.request.maxNumberOfEvents} events in ${watch.elapsedTimeAsString()}`);
        return {
            type: 'generate-partition-response',
            generatedEventCount: eventCount,
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        };
    }

    private async applyBackpressure(req: IncomingMessageEnvelope<Request<GeneratePartitionRequest>>, eventCount: number, isFinal?: boolean) {
        let threshold = this.config.collector.instances > 1 ? 
                            this.config.backpressure.waitThreshold * this.config.collector.instances * 0.6 :
                            this.config.backpressure.waitThreshold;
        if (isFinal === true) {
            threshold = 0;
        }
        const waitWatch = Stopwatch.startNew();
        const timeoutWatch = Stopwatch.startNew();
        let iterations = 0;
        while (true) {
            if (req.shouldCancel) {
                this.logger.warn('While waiting for back pressure, sub-generator should stop immediatly!');
                break;
            }
            const state = this.messageTrackingCollection.find(this.messageBus.identity);
            if (timeoutWatch.elapsedTimeInMS() >= this.config.backpressure.waitTimeoutInMS) {
                this.logger.debug(`back pressure timed out after ${timeoutWatch.elapsedTimeAsString()}`, 'seq=', state?.tracking.sequence, 'counter=', state?.counter);
                if (isFinal) {
                    timeoutWatch.restart();
                } else {
                    break;
                }
            }
            if (state) {
                const delta = eventCount - (state.tracking.sequence + 1);
                if (delta > threshold) {
                    // this.logger.debug(`${iterations}: delta = ${eventCount} - ${state.tracking.sequence} = ${delta}`);
                    await sleep(5);
                } else {
                    break;
                }    
            } else {
                // this.logger.debug('Backpressure has no state yet. Will wait...');
                await sleep(req.body.body.request.pauseDelayInMSecs ?? 100);
            }
            iterations += 1;
        }    
        if (iterations > 0) {
            this.logger.debug(`back pressure for ${iterations} iterations, during ${waitWatch.elapsedTimeAsString()}`);
        }
    }
}