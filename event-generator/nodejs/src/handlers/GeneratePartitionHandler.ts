import { GeneratePartitionCommand, GeneratePartitionStats, RequestHandler, IncomingMessageEnvelope, Request } from "core-lib";
import { addOffsetToCoordinates, computeHashNumber, Config, formatPoint, GpsCoordinates, KM, Logger, IMessageBus, MoveCommand, Rect, sleep, Stopwatch } from "core-lib";
import { DataPartitionStrategy } from "../data/DataPartitionStrategy.js";
import { VehiclePredicate, Engine } from "../simulation/engine.js";

export class GeneratePartitionHandler extends RequestHandler<GeneratePartitionCommand, GeneratePartitionStats> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private generatorIndex: number,
        private dataPartitionStrategy: DataPartitionStrategy<MoveCommand>,
    ) {
        super();
    }

    get eventTypes(): string[] {
        return ['generate-partition'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<GeneratePartitionCommand>>): Promise<GeneratePartitionStats> {
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
                const dataPartitionKey = this.dataPartitionStrategy.getPartitionKey(msg);
                const collectorIndex = computeHashNumber(dataPartitionKey) % this.config.collector.instances;
                this.messageBus.publish(`commands.move.${collectorIndex}`, msg);
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
            if (!done) {
                if (realtime) {
                    const delta = refreshIntervalInMS - accumulatedWaitInMS;
                    if (delta > 0) {
                        await sleep(delta);
                    }
                } else {
                    await sleep(1);
                }    
            }
        }
        watch.stop();
        this.logger.info(`Done generating ${eventCount} out of ${event.request.maxNumberOfEvents} events in ${watch.elapsedTimeAsString()}`);
        return {
            type: 'generate-partition-stats',
            generatedEventCount: eventCount,
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        };
    }
}