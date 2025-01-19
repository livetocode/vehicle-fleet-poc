import { Counter } from "messaging-lib";
import { getProcessStats } from "../core/diagnostics/processStats.js";
import { Accumulator, Splitter } from "data-lib";
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

function compareVehicles(a: PersistedMoveCommand, b: PersistedMoveCommand): number {
    const delta = a.vehicleId.localeCompare(b.vehicleId);
    if (delta === 0) {
        return a.timestamp.getTime() - b.timestamp.getTime();
    }
    return delta;
}