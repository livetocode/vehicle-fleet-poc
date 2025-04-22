import { GeneratePartitionResponse, RequestHandler, IncomingMessageEnvelope, Request, GeneratePartitionRequest, MessageTrackingCollection } from "core-lib";
import { addOffsetToCoordinates, computeHashNumber, Config, formatPoint, GpsCoordinates, KM, Logger, IMessageBus, MoveCommand, Rect, sleep, Stopwatch } from "core-lib";
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
        let distributedRefreshIntervalInMS;
        let distributedRefreshFrequency;
        if (vehicleCount < refreshIntervalInMS) {
            distributedRefreshIntervalInMS = Math.trunc(refreshIntervalInMS / vehicleCount);
            distributedRefreshFrequency = 1;
        } else {
            distributedRefreshFrequency = Math.trunc(vehicleCount / refreshIntervalInMS);
            distributedRefreshIntervalInMS = Math.trunc(refreshIntervalInMS / distributedRefreshFrequency);
        }
        if (realtime) {
            this.logger.debug(`Realtime wait: ${distributedRefreshIntervalInMS} ms every ${distributedRefreshFrequency} vehicles`)
        }
        const watch = new Stopwatch();
        watch.start();
        const useBackpressure = this.config.backpressure.enabled && 
                                req.body.body.request.useBackpressure === true;
        let eventCount = 0;
        let done = false;
        while (!done) {
            let accumulatedWaitInMS = 0;
            const commands = engine.execute();
            let idx = 0;
            for (const cmd of commands) {
                this.logger.trace(cmd.timestamp, `Vehicle #${cmd.vehicle.id} ${cmd.newState.direction} ${formatPoint(cmd.vehicle.location)} speed=${cmd.newState.speed} localBounds=${cmd.newState.localBounds.toString()}, offset=${formatPoint(cmd.newState.offset)}`);
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
                this.messageBus.publish(`commands.move`, msg);
                eventCount++;
                idx++;
                if (eventCount >= event.maxNumberOfEvents) {
                    done = true;
                    break;
                }
                if (req.shouldCancel === true) {
                    this.logger.warn('Sub-generator should stop immediatly!');
                    done = true;
                    break;
                }
                if (realtime) {
                    if (idx % distributedRefreshFrequency === 0) {
                        await sleep(distributedRefreshIntervalInMS);
                        accumulatedWaitInMS += distributedRefreshIntervalInMS;
                    }
                }
            }
            if (!done || useBackpressure) {
                if (realtime) {
                    const delta = refreshIntervalInMS - accumulatedWaitInMS;
                    if (delta > 0) {
                        await sleep(delta);
                    }
                } else if (useBackpressure) {
                    await this.applyBackpressure(event, eventCount);
                } else {
                    await sleep(event.request.pauseDelayInMSecs ?? 1);
                }    
            }
        }
        watch.stop();
        this.logger.info(`Done generating ${eventCount} out of ${event.request.maxNumberOfEvents} events in ${watch.elapsedTimeAsString()}`);
        return {
            type: 'generate-partition-response',
            generatedEventCount: eventCount,
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        };
    }

    private async applyBackpressure(event: GeneratePartitionRequest, eventCount: number) {
        const threshold = this.config.collector.instances > 1 ? 
                            this.config.backpressure.waitThreshold * this.config.collector.instances * 0.6 :
                            this.config.backpressure.waitThreshold;
        const waitWatch = Stopwatch.startNew();
        let iterations = 0;
        while (true) {
            const state = this.messageTrackingCollection.find(this.messageBus.identity);
            if (waitWatch.elapsedTimeInMS() >= this.config.backpressure.waitTimeoutInMS) {
                this.logger.debug(`back pressure timed out after ${waitWatch.elapsedTimeAsString()}`, 'seq=', state?.tracking.sequence, 'counter=', state?.counter);
                break;
            }
            if (state) {
                const delta = eventCount - state.tracking.sequence;
                if (delta > threshold) {
                    // this.logger.debug(`${iterations}: delta = ${eventCount} - ${state.tracking.sequence} = ${delta}`);
                    await sleep(5);
                } else {
                    break;
                }    
            } else {
                // this.logger.debug('Backpressure has no state yet. Will wait...');
                await sleep(event.request.pauseDelayInMSecs ?? 100);
            }
            iterations += 1;
        }    
        if (iterations > 0) {
            this.logger.debug(`back pressure for ${iterations} iterations, during ${waitWatch.elapsedTimeAsString()}`);
        }
    }
}