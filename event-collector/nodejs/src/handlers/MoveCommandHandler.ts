import { Counter } from "messaging-lib";
import { AggregatePeriodStats, Config, DataPartitionStats, FlushCommand, EventHandler, Logger, MessageBus, MoveCommand, Stopwatch, TimeRange, calcTimeWindow, computeHashNumber, MessageEnvelope } from 'core-lib';
import { EventStore, StoredEvent } from "../core/persistence/EventStore.js";
import { AggregateStore } from "../core/persistence/AggregateStore.js";
import { DataPartitionStrategy } from "../core/data/DataPartitionStrategy.js";
import { GeohashDataPartitionStrategy } from "../core/data/GeohashDataPartitionStrategy.js";
import { getProcessStats } from "../core/diagnostics/processStats.js";
import { Accumulator, Splitter } from "data-lib";

const vehicles_collector_partitions_total_counter = new Counter({
    name: 'vehicles_collector_partitions_total',
    help: 'number of partitions persisted by the event collector',
    labelNames: ['is_partial'],
});

const vehicles_collector_partitions_objects_total_counter = new Counter({
    name: 'vehicles_collector_partitions_objects_total',
    help: 'number of objects in the partitions persisted by the event collector',
    labelNames: ['is_partial'],
});

const vehicles_collector_partitions_duration_secs_total_counter = new Counter({
    name: 'vehicles_collector_partitions_duration_secs_total',
    help: 'Elapsed time in seconds when persisting partitions aggregated by the event collector',
    labelNames: ['is_partial'],
});

const vehicles_collector_partitions_size_counter = new Counter({
    name: 'vehicles_collector_partitions_size',
    help: 'storage size of the partitions persisted by the event collector, in bytes',
    labelNames: ['is_partial'],
});

export interface PersistedMoveCommand {
    timestamp: Date;
    vehicleId: string;
    vehicleType: string;
    gps_lat: number;
    gps_lon: number;
    gps_alt: number;
    geoHash: string;
    speed: number;
    direction: string;
}

export class MoveCommandHandler extends EventHandler<MoveCommand | FlushCommand> {
    private accumulator: MoveCommandAccumulator;
    private geohashPartitioner: GeohashDataPartitionStrategy;

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: MessageBus,
        private eventStore: EventStore<PersistedMoveCommand>,
        aggregateStore: AggregateStore<PersistedMoveCommand>,        
        private dataPartitionStrategy: DataPartitionStrategy<MoveCommand>,
        private collectorIndex: number,
    ) {
        super();
        this.geohashPartitioner = new GeohashDataPartitionStrategy(config.collector.geohashLength);
        this.accumulator = new MoveCommandAccumulator(
            config,
            logger,
            messageBus,
            eventStore,
            aggregateStore,
            collectorIndex,
        );
    }

    get eventTypes(): string[] {
        return ['move', 'flush']; 
    }

    async init(): Promise<void> {
        await this.restore();
    }

    async process(msg: MessageEnvelope<MoveCommand | FlushCommand>): Promise<void> {
        const event = msg.body;
        if (event.type === 'flush') {
            return this.processFlushCommand(event);
        }
        if (event.type === 'move') {
            return this.processMoveCommand(event);
        }
        throw new Error(`Unexpected event '${(event as any).type}'`);
    }

    private async processFlushCommand(event: FlushCommand): Promise<void> {
        this.logger.warn('Trigger flush');
        await this.accumulator.flush();
        if (event.exitProcess) {
            await this.messageBus.stop();
        }
    }
    
    private async processMoveCommand(event: MoveCommand): Promise<void> {
        const dataPartitionKey = this.dataPartitionStrategy.getPartitionKey(event);
        const collectorIndex = computeHashNumber(dataPartitionKey) % this.config.collector.instances;
        if (this.collectorIndex !== collectorIndex) {
            this.logger.warn(`Received event for wrong collector index #${collectorIndex}`);
            return;
        }
        this.logger.trace(event);
        const geoHash = this.geohashPartitioner.getPartitionKey(event);
        const storedEvent: StoredEvent<PersistedMoveCommand> = { 
            timestamp: new Date(event.timestamp), 
            partitionKey: dataPartitionKey, 
            collectorIndex,
            event: {
                timestamp: new Date(event.timestamp),
                vehicleId: event.vehicleId,
                vehicleType: event.vehicleType,
                gps_lat: event.gps.lat,
                gps_lon: event.gps.lon,
                gps_alt: event.gps.alt,
                geoHash,
                speed: event.speed,
                direction: event.direction,
            },
        };
        await this.eventStore.write(storedEvent);
        await this.accumulator.write(storedEvent);
    }

    private async restore(): Promise<void> {
        this.logger.info('Restoring move command accumulator from storage...');
        let count = 0;
        for await (const batch of this.eventStore.fetch(this.collectorIndex)) {
            for (const ev of batch) {
                this.accumulator.write(ev);
                count += 1;
            }
        }
        this.logger.info(`Restored ${count} move command accumulator from storage.`);
    }
}

export class MoveCommandAccumulator extends Accumulator<StoredEvent<PersistedMoveCommand>, TimeRange> {
    constructor(
        private config: Config,
        protected logger: Logger,
        private messageBus: MessageBus,
        private eventStore: EventStore<PersistedMoveCommand>,
        private aggregateStore: AggregateStore<PersistedMoveCommand>,
        private collectorIndex: number,
    ) {
        super(logger, config.partitioning.timePartition.maxCapacity, config.partitioning.timePartition.maxActivePartitions);
    }
    
    protected getPartitionKey(obj: StoredEvent<PersistedMoveCommand>): TimeRange {
        return calcTimeWindow(obj.timestamp, this.config.partitioning.timePartition.aggregationPeriodInMin);
    }
    
    protected getMaxValidPartitionKey(): TimeRange {
        const maxFuturePartitions = Math.max(1, Math.round(this.maxActivePartitions * 0.3)); // 30% of the active partitions
        const aggregationPeriodInMS = this.config.partitioning.timePartition.aggregationPeriodInMin * 60 * 1000;
        const nextTimeRangeFromNow = Date.now() + maxFuturePartitions * aggregationPeriodInMS;
        return calcTimeWindow(new Date(nextTimeRangeFromNow), this.config.partitioning.timePartition.aggregationPeriodInMin);
    }

    protected async persistObjects(objects: StoredEvent<PersistedMoveCommand>[], partitionKey: TimeRange, isPartial: boolean, partialFlushSequence: number): Promise<void> {
        const formats = new Set<string>();
        const watch = new Stopwatch();
        watch.start();
        let partitionStats: DataPartitionStats[] = [];
        const splitter = new Splitter<StoredEvent<PersistedMoveCommand>>((ev) => ev.partitionKey);
        splitter.addObjects(objects);
        let subPartitionCount = 0;
        for (const { groupKey, groupItems } of splitter.enumerate()) {
            const sortedItems = groupItems.map(x => x.event).sort(compareVehicles);
            const watch2 = new Stopwatch();
            watch2.start();
            const groupWriteStats = await this.aggregateStore.write(partitionKey, `${groupKey}-${partialFlushSequence}`, sortedItems);
            watch2.stop();
            partitionStats.push(...groupWriteStats);
            subPartitionCount++;
            for (const file of groupWriteStats) {
                formats.add(file.format);
            }
            vehicles_collector_partitions_total_counter.inc({ is_partial: isPartial.toString()});
            vehicles_collector_partitions_objects_total_counter.inc({ is_partial: isPartial.toString()}, sortedItems.length);
            vehicles_collector_partitions_duration_secs_total_counter.inc({ is_partial: isPartial.toString() }, watch2.elapsedTimeInSecs());
            const size = groupWriteStats.map(x => x.size).reduce((a, b) => a + b, 0);
            vehicles_collector_partitions_size_counter.inc({ is_partial: isPartial.toString() }, size);
        }
        watch.stop();
        this.logger.debug(`Splitted partition into ${subPartitionCount} subpartitions`);
        const totalElapsedTimeInMS = this.firstEventReceivedAt ? new Date().getTime() - this.firstEventReceivedAt.getTime() : 0;
        const statsEvent: AggregatePeriodStats = {
            type: 'aggregate-period-stats',
            collectorCount: this.config.collector.instances,
            collectorIndex: this.collectorIndex,
            fromTime: partitionKey.fromTime.toUTCString(),
            toTime: partitionKey.untilTime.toUTCString(),
            partitionKey: partitionKey.toString(),
            isPartial,
            eventCount: objects.length,
            partitions: partitionStats,
            formats: [...formats],
            elapsedTimeInMS: watch.elapsedTimeInMS(),
            totalElapsedTimeInMS,
            processStats: getProcessStats(),
            totalRejectedMessagesInTheFuture: this.totalRejectedMessagesInTheFuture,
            totalRejectedMessagesInThePast: this.totalRejectedMessagesInThePast,
        }
        this.messageBus.publish('stats', statsEvent);
        await this.eventStore.delete(partitionKey, this.collectorIndex);
    }

}

function compareVehicles(a: PersistedMoveCommand, b: PersistedMoveCommand): number {
    const delta = a.vehicleId.localeCompare(b.vehicleId);
    if (delta === 0) {
        return a.timestamp.getTime() - b.timestamp.getTime();
    }
    return delta;
}