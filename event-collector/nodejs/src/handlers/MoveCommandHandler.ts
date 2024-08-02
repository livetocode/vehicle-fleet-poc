import { GenericEventHandler } from "messaging-lib";
import { AggregatePeriodStats, CollectorConfig, Command, DataPartitionStats, FlushCommand, Logger, MoveCommand, Stopwatch, TimeRange, calcTimeWindow, computeHashNumber } from 'core-lib';
import { EventStore, StoredEvent } from "../core/persistence/EventStore.js";
import { Accumulator } from "../core/data/Accumulator.js";
import { Splitter } from "../core/data/Splitter.js";
import { AggregateStore } from "../core/persistence/AggregateStore.js";
import { MessageBus } from "messaging-lib";
import { DataPartitionStrategy } from "../core/data/DataPartitionStrategy.js";
import { GeohashDataPartitionStrategy } from "../core/data/GeohashDataPartitionStrategy.js";

export interface PersistedMoveCommand {
    timestamp: string;
    vehicleId: string;
    gps_lat: number;
    gps_lon: number;
    gps_alt: number;
    geoHash: string;
    speed: number;
    direction: string;
}

export class MoveCommandHandler extends GenericEventHandler<MoveCommand> {
    private accumulator: MoveCommandAccumulator;
    private geohashPartitioner: GeohashDataPartitionStrategy;

    constructor(
        private config: CollectorConfig,
        private logger: Logger,
        private messageBus: MessageBus,
        private eventStore: EventStore<PersistedMoveCommand>,
        aggregateStore: AggregateStore<PersistedMoveCommand>,
        private dataPartitionStrategy: DataPartitionStrategy<MoveCommand>,
        private collectorIndex: number,
    ) {
        super();
        this.geohashPartitioner = new GeohashDataPartitionStrategy(config.geohashLength);
        this.accumulator = new MoveCommandAccumulator(
            config,
            logger,
            messageBus,
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

    process(event: Command): Promise<void> {
        if (event.type === 'flush') {
            // TODO: review how we flush when we have multiple collectors!
            // This way is ok with a pub/sub but would not work with a queue and competing consumers.
            return this.processFlushEvent(event);
        }
        return super.process(event);
    }
    
    protected async processFlushEvent(event: FlushCommand): Promise<void> {
        this.logger.warn('Trigger flush');
        await this.accumulator.flush();
        if (event.exitProcess) {
            await this.messageBus.stop();
        }
    }

    protected async processTypedEvent(event: MoveCommand): Promise<void> {
        const dataPartitionKey = this.dataPartitionStrategy.getPartitionKey(event);
        const collectorIndex = computeHashNumber(dataPartitionKey) % this.config.collectorCount;
        if (this.collectorIndex !== collectorIndex) {
            this.logger.warn(`Received event for wrong collector index #${collectorIndex}`);
            return;
        }
        const geoHash = this.dataPartitionStrategy instanceof GeohashDataPartitionStrategy ? 
            dataPartitionKey : this.geohashPartitioner.getPartitionKey(event);
        const storedEvent: StoredEvent<PersistedMoveCommand> = { 
            timestamp: new Date(event.timestamp), 
            partitionKey: dataPartitionKey, 
            collectorIndex,
            event: {
                timestamp: event.timestamp,
                vehicleId: event.vehicleId,
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

    protected async restore(): Promise<void> {
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
        private config: CollectorConfig,
        protected logger: Logger,
        private messageBus: MessageBus,
        private aggregateStore: AggregateStore<PersistedMoveCommand>,
        private collectorIndex: number,
    ) {
        super(logger);
    }
    
    protected getPartitionKey(obj: StoredEvent<PersistedMoveCommand>): TimeRange {
        return calcTimeWindow(obj.timestamp, this.config.aggregationPeriodInMin);
    }

    protected async persistObjects(objects: StoredEvent<PersistedMoveCommand>[], partitionKey: TimeRange): Promise<void> {
        // TODO: measure CPU and RAM
        const formats = new Set<string>();
        const watch = new Stopwatch();
        watch.start();
        let partitionStats: DataPartitionStats[] = [];
        const splitter = new Splitter<StoredEvent<PersistedMoveCommand>>((ev) => ev.partitionKey);
        splitter.addObjects(objects);
        let subPartitionCount = 0;
        for (const { groupKey, groupItems } of splitter.enumerate()) {
            const sortedItems = groupItems.map(x => x.event).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            const groupWriteStats = await this.aggregateStore.write(partitionKey, groupKey, sortedItems);
            partitionStats.push(...groupWriteStats);
            subPartitionCount++;
            for (const file of groupWriteStats) {
                formats.add(file.format);
            }
        }
        watch.stop();
        this.logger.debug(`Splitted partition into ${subPartitionCount} subpartitions`);
        const statsEvent: AggregatePeriodStats = {
            type: 'aggregate-period-stats',
            collectorCount: this.config.collectorCount,
            collectorIndex: this.collectorIndex,
            fromTime: partitionKey.fromTime.toUTCString(),
            toTime: partitionKey.untilTime.toUTCString(),
            partitionKey: partitionKey.toString(),
            eventCount: objects.length,
            partitions: partitionStats,
            formats: [...formats],
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        }
        this.messageBus.publish('stats', statsEvent);
    }

}