import { addOffsetToCoordinates, ClearVehiclesData, ClearVehiclesDataResult, computeHashNumber, Config, FlushCommand, formatPoint, GeneratePartitionCommand, GeneratePartitionStats, GenerationStats, GeneratorConfig, GpsCoordinates, KM, Logger, MoveCommand, Rect, ResetAggregatePeriodStats, sleep, StartGenerationCommand, StopGenerationCommand, Stopwatch } from "core-lib";
import { GenericEventHandler, MessageBus } from "messaging-lib";
import { DataPartitionStrategy } from "../data/DataPartitionStrategy.js";
import { VehiclePredicate, Engine } from "../simulation/engine.js";


export class StartGenerationHandler extends GenericEventHandler<StartGenerationCommand | StopGenerationCommand | GeneratePartitionCommand | GeneratePartitionStats | ClearVehiclesDataResult> {
    private subGenerators = new Map<string, Set<string>>();
    private stopGenerationRequested = false;
    private pendingClearRequests = new Map<string, ClearVehiclesDataResult | null>();

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: MessageBus,
        private generatorIndex: number,
        private dataPartitionStrategy: DataPartitionStrategy<MoveCommand>,
    ) {
        super();
    }

    get eventTypes(): string[] {
        return ['start-generation', 'stop-generation', 'generate-partition', 'generate-partition-stats', 'clear-vehicles-data-result'];
    }
    
    protected processTypedEvent(event: StartGenerationCommand | StopGenerationCommand | GeneratePartitionCommand | GeneratePartitionStats | ClearVehiclesDataResult): Promise<void> {
        if (event.type === 'start-generation') {
            return this.processStart(event);
        }
        if (event.type === 'stop-generation') {
            return this.processStop(event);
        }
        if (event.type === 'generate-partition') {
            return this.processPartition(event);
        }
        if (event.type === 'generate-partition-stats') {
            return this.processPartitionStats(event);
        }
        if (event.type === 'clear-vehicles-data-result') {
            return this.processClearDataResponse(event);
        }
        throw new Error(`Unexpected event type "${(event as any).type}"`);
    }

    protected async processStart(event: StartGenerationCommand): Promise<void> {
        this.logger.info('Received event', event);
        let subGenerators = this.subGenerators.get(event.id);
        if (!subGenerators) {
            subGenerators = new Set<string>();
            this.subGenerators.set(event.id, subGenerators);
        }
        try {
            // reset stats
            this.messageBus.publish(`stats`, { type: 'reset-aggregate-period-stats' } as ResetAggregatePeriodStats);

            // delete existing events
            const clearRequest: ClearVehiclesData = {
                type: 'clear-vehicles-data', 
                id: crypto.randomUUID(),
                replyTo: this.messageBus.privateInboxName,
            };
            this.messageBus.publish(`requests.collector`, clearRequest);
            this.pendingClearRequests.set(clearRequest.id, null);
            const clearResponse = await this.waitForClearResponse(clearRequest);
            if (!clearResponse.success) {
                throw new Error('Collector could not clear the data!');
            }
            this.logger.info('Existing data has been cleared by a collector.');

            // partition generation work
            const startDate = getStartDate(event, this.config.generator.startDate);

            for (let i = 0; i < this.config.generator.instances; i++) {
                let maxNumberOfEvents = Math.trunc(event.maxNumberOfEvents / this.config.generator.instances);
                if (i === 0) {
                    maxNumberOfEvents += event.maxNumberOfEvents % this.config.generator.instances;
                }
                const generatePartition: GeneratePartitionCommand = {
                    type: 'generate-partition',
                    replyTo: this.messageBus.privateInboxName,
                    subRequestId: crypto.randomUUID(),
                    maxNumberOfEvents,
                    startDate,
                    request: event,
                }
                this.messageBus.publish(`generation.agent.${i}`, generatePartition);
                subGenerators.add(generatePartition.subRequestId);
            }
            // wait for generation to complete
            const watch = new Stopwatch();
            watch.start();
            while (subGenerators.size > 0) {
                await sleep(1000);            
            }
            watch.stop();
            
            // flush collectors
            const flushCmd: FlushCommand = {
                type: 'flush',
                exitProcess: false,
            }
            for (let i = 0; i < this.config.collector.instances; i++) {
                this.logger.info(`Flushing collector #${i}`);
                this.messageBus.publish(`commands.flush.${i}`, flushCmd);
            }

            // send response stats
            const stats: GenerationStats = {
                type: 'generation-stats',
                requestId: event.id,
                elapsedTimeInMS: watch.elapsedTimeInMS(),
            };
            this.messageBus.publish(event.replyTo, stats);
        } finally {
            this.subGenerators.delete(event.id);
        }
    }
    
    protected async processStop(event: StopGenerationCommand): Promise<void> {
        this.logger.warn('Stop generation request', event);
        // this.subGenerators.clear();
        this.stopGenerationRequested = true;
    }

    protected async processClearDataResponse(event: ClearVehiclesDataResult) {
        if (this.pendingClearRequests.has(event.requestId)) {
            this.pendingClearRequests.set(event.requestId, event);
        }
    }

    protected async processPartitionStats(event: GeneratePartitionStats): Promise<void> {
        let subGenerators = this.subGenerators.get(event.requestId);
        if (subGenerators) {
            subGenerators.delete(event.subRequestId);
        }
    }

    protected async processPartition(event: GeneratePartitionCommand): Promise<void> {
        this.stopGenerationRequested = false;
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
                if (realtime) {
                    if (idx % distributedRefreshFrequency === 0) {
                        await sleep(distributedRefreshIntervalInMS);
                        accumulatedWaitInMS += distributedRefreshIntervalInMS;
                    }
                }
                if (this.stopGenerationRequested) {
                    this.logger.warn('Sub-generator should stop immediatly!');
                    done = true;
                    this.stopGenerationRequested = false;
                    break;
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
        const stats: GeneratePartitionStats = {
            type: 'generate-partition-stats',
            requestId: event.request.id,
            subRequestId: event.subRequestId,
            generatedEventCount: eventCount,
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        };
        this.messageBus.publish(event.replyTo, stats);
    }

    private async waitForClearResponse(request: ClearVehiclesData): Promise<ClearVehiclesDataResult> {
        while(true) {
            await sleep(100);
            const result = this.pendingClearRequests.get(request.id);
            if (result === undefined) {
                throw new Error(`There is no pending request ID '${request.id}'`);
            }
            if (result !== null) {
                return result;
            }
        }
    }
}

function getStartDate(event: StartGenerationCommand, defaultStartDate?: string): string {
    if (event.realtime) {
        return new Date().toISOString();
    }
    const startDate = event.startDate ?? defaultStartDate;
    if (startDate) {
        return new Date(startDate).toISOString();
    }
    const offsetInMS = (event.maxNumberOfEvents / event.vehicleCount) * event.refreshIntervalInSecs * 1000;
    const now = new Date();
    return new Date(now.getTime() - offsetInMS).toISOString();
}
