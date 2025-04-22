import { Counter } from "messaging-lib";
import { getProcessStats } from "../core/diagnostics/processStats.js";
import { Accumulator, BaseAccumulator, ArrayContainer, Container, ContainerManager, ContainerPersister, ContainerPersisterArgs, KeyProvider, MapContainer, OutOfOrderError, SortedContainer, Splitter } from "data-lib";
import { TimeRange, Config, Logger, MessageBus, calcTimeWindow, Stopwatch, DataPartitionStats, AggregatePeriodCreated } from "core-lib";
import { AggregateStore } from "../core/persistence/AggregateStore.js";
import { StoredEvent, EventStore } from "../core/persistence/EventStore.js";

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

export class MoveCommandAccumulatorV1 extends BaseAccumulator<StoredEvent<PersistedMoveCommand>, TimeRange> {
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
        const statsEvent: AggregatePeriodCreated = {
            type: 'aggregate-period-created',
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
        this.messageBus.publish('events.vehicles.aggregate-period.created', statsEvent);
        await this.eventStore.delete(partitionKey, this.collectorIndex);
    }

}

export type EventContainerFactoryArgs<TItem> = {
    aggregationStrategy: 'timeThenGeohash' | 'geohashThenTime';
    logger: Logger;
    maxCapacity: number;
    maxActivePartitions: number;
    flushThresholdRatio: number;
    timeRangeProvider: KeyProvider<TItem>;
    geohashProvider: KeyProvider<TItem>;
    persister: ContainerPersister<TItem>;
}

export function createEventPipeline<TItem>(args: EventContainerFactoryArgs<TItem>): Container<TItem> {
    const manager = new ContainerManager<TItem>(args.logger, args.maxCapacity, args.flushThresholdRatio);
    const eventContainerFactory = () => new ArrayContainer<TItem>(manager, args.persister);
    if (args.aggregationStrategy === 'geohashThenTime') {
        const timeWindowContainerFactory = () => new SortedContainer<TItem>(args.maxActivePartitions, manager, args.timeRangeProvider, eventContainerFactory);
        const geohashContainer = new MapContainer<TItem>(manager, args.geohashProvider, timeWindowContainerFactory);
        return geohashContainer;    
    } else if (args.aggregationStrategy === 'timeThenGeohash') {
        const geohashContainerFactory = () => new MapContainer<TItem>(manager, args.geohashProvider, eventContainerFactory);
        const timeWindowContainer = new SortedContainer<TItem>(args.maxActivePartitions, manager, args.timeRangeProvider, geohashContainerFactory);
        return timeWindowContainer;    
    } else {
        throw new Error(`Unknown aggregation strategy: ${args.aggregationStrategy}`);
    }
}

export class MoveCommandAccumulatorV2 implements Accumulator<StoredEvent<PersistedMoveCommand>> {
    private container: Container<StoredEvent<PersistedMoveCommand>>;
    protected firstEventReceivedAt?: Date;
    private eventCounter = 0;
    private persistCalls = 0;
    private totalRejectedMessagesInThePast = 0;

    constructor(
        private config: Config,
        protected logger: Logger,
        private messageBus: MessageBus,
        private eventStore: EventStore<PersistedMoveCommand>,
        private aggregateStore: AggregateStore<PersistedMoveCommand>,
        private collectorIndex: number,
    ) {
        this.container = createEventPipeline<StoredEvent<PersistedMoveCommand>>({
            aggregationStrategy: 'geohashThenTime',
            logger,
            maxCapacity: config.partitioning.timePartition.maxCapacity,
            maxActivePartitions: config.partitioning.timePartition.maxActivePartitions,
            flushThresholdRatio: 0.24,
            geohashProvider: (item: StoredEvent<PersistedMoveCommand>) => item.partitionKey,
            timeRangeProvider: (item: StoredEvent<PersistedMoveCommand>) => this.getPartitionKey(item).toString(),
            persister: (args: ContainerPersisterArgs<StoredEvent<PersistedMoveCommand>>) => {
                if (args.items.length === 0) { return Promise.resolve(); }
                return this.persistObjects(args.items, this.getPartitionKey(args.items[0]), args.isPartialFlush, args.partialFlushCounter);
            }
        });
    }
    
    async write(obj: StoredEvent<PersistedMoveCommand>): Promise<void> {
        if (!this.firstEventReceivedAt) {
            this.firstEventReceivedAt = new Date();
        }
        try {
            await this.container.add(obj);
            this.eventCounter += 1;    
        } catch(err) {
            if (err instanceof OutOfOrderError) {
                this.totalRejectedMessagesInThePast += 1;
            } else {
                throw err;
            }
        }
    }

    async flush(): Promise<void> {
        await this.container.flush(false);
        this.logger.info('Received ', this.eventCounter, ' events');
        this.logger.info('Invoked ', this.persistCalls, ' persistObjects');
        this.eventCounter = 0;
        this.persistCalls = 0;
        this.firstEventReceivedAt = undefined;
    }

    protected getPartitionKey(obj: StoredEvent<PersistedMoveCommand>): TimeRange {
        return calcTimeWindow(obj.timestamp, this.config.partitioning.timePartition.aggregationPeriodInMin);
    }
    
    protected async persistObjects(objects: StoredEvent<PersistedMoveCommand>[], partitionKey: TimeRange, isPartial: boolean, partialFlushSequence: number): Promise<void> {
        if (objects.length === 0) {
            this.logger.warn('Trying to persist objects but there are none! PartitionKey = ', partitionKey.toString());
            return;
        }
        this.persistCalls += 1;
        const formats = new Set<string>();
        const watch = Stopwatch.startNew();
        let partitionStats: DataPartitionStats[] = [];
        const groupKey = objects[0].partitionKey;
        const groupItems = objects;
        const sortedItems = groupItems.map(x => x.event).sort(compareVehicles);
        const groupWriteStats = await this.aggregateStore.write(partitionKey, `${groupKey}-${partialFlushSequence}`, sortedItems);
        watch.stop();
        partitionStats.push(...groupWriteStats);
        for (const file of groupWriteStats) {
            formats.add(file.format);
        }
        vehicles_collector_partitions_total_counter.inc({ is_partial: isPartial.toString()});
        vehicles_collector_partitions_objects_total_counter.inc({ is_partial: isPartial.toString()}, sortedItems.length);
        vehicles_collector_partitions_duration_secs_total_counter.inc({ is_partial: isPartial.toString() }, watch.elapsedTimeInSecs());
        const size = groupWriteStats.map(x => x.size).reduce((a, b) => a + b, 0);
        vehicles_collector_partitions_size_counter.inc({ is_partial: isPartial.toString() }, size);
        if (partitionStats.length === 0) {
            this.logger.warn('aggregateStore produced no stats! PartitionKey = ', partitionKey.toString());
            return;
        }
        const totalElapsedTimeInMS = this.firstEventReceivedAt ? new Date().getTime() - this.firstEventReceivedAt.getTime() : 0;
        const statsEvent: AggregatePeriodCreated = {
            type: 'aggregate-period-created',
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
            totalRejectedMessagesInTheFuture: 0, // this.totalRejectedMessagesInTheFuture,
            totalRejectedMessagesInThePast: this.totalRejectedMessagesInThePast,
        }
        this.messageBus.publish('events.vehicles.aggregate-period.created', statsEvent);
        await this.eventStore.delete(partitionKey, this.collectorIndex);
        this.totalRejectedMessagesInThePast = 0;
    }

}

function compareVehicles(a: PersistedMoveCommand, b: PersistedMoveCommand): number {
    const delta = a.vehicleId.localeCompare(b.vehicleId);
    if (delta === 0) {
        return a.timestamp.getTime() - b.timestamp.getTime();
    }
    return delta;
}

export class MoveCommandAccumulator extends MoveCommandAccumulatorV2 {

}
