import { GenericEventHandler } from "messaging-lib";
import { AggregateFileStats, CollectorConfig, Command, FileWriteStats, FlushCommand, Logger, MoveCommand, TimeRange, calcTimeWindow, computeHashNumber } from 'core-lib';
import { EventStore, StoredEvent } from "../core/persistence/EventStore.js";
import Geohash from 'latlon-geohash';
import { Accumulator } from "../core/data/Accumulator.js";
import { Splitter } from "../core/data/Splitter.js";
import { AggregateStore } from "../core/persistence/AggregateStore.js";
import { randomUUID } from "crypto";
import { MessageBus } from "messaging-lib";

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

    constructor(
        private config: CollectorConfig,
        private logger: Logger,
        private messageBus: MessageBus,
        private eventStore: EventStore<PersistedMoveCommand>,
        aggregateStore: AggregateStore<PersistedMoveCommand>,
        private collectorIndex: number,
    ) {
        super();
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
            return this.processFlushEvent(event);
        }
        return super.process(event);
    }
    
    protected async processFlushEvent(event: FlushCommand): Promise<void> {
        this.logger.warn('Trigger flush');
        await this.accumulator.flush();
        if (event.exitProcess) {
            await this.messageBus.drain();
        }
    }

    protected async processTypedEvent(event: MoveCommand): Promise<void> {
        const geoHash = (Geohash as any).encode(event.gps.lat, event.gps.lon, this.config.geohashLength); 
        const collectorIndex = this.config.collectorCount > 1 ? computeHashNumber(geoHash) % this.config.collectorCount : 0;
        if (this.collectorIndex !== collectorIndex) {
            return;
        }
        const storedEvent: StoredEvent<PersistedMoveCommand> = { 
            timestamp: new Date(event.timestamp), 
            partitionKey: geoHash, 
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
        return calcTimeWindow(obj.timestamp, this.config.aggregationWindowInMin);
    }

    protected async persistObjects(objects: StoredEvent<PersistedMoveCommand>[], partitionKey: TimeRange): Promise<void> {
        let writeStats: FileWriteStats[] = [];
        if (this.config.splitByGeohash) {
            const splitter = new Splitter<StoredEvent<PersistedMoveCommand>>((ev) => ev.partitionKey);
            splitter.addObjects(objects);
            let subPartitionCount = 0;
            for (const { groupKey, groupItems } of splitter.enumerate()) {
                const sortedItems = groupItems.map(x => x.event).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                const groupWriteStats = await this.aggregateStore.write(partitionKey, groupKey, sortedItems);
                writeStats.push(...groupWriteStats);
                subPartitionCount++;
            }
            this.logger.debug(`Splitted partition into ${subPartitionCount} subpartitions`);
        } else {
            const sortedItems = objects.map(x => x.event).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            writeStats = await this.aggregateStore.write(partitionKey, randomUUID(), sortedItems);
        }
        const statsEvent: AggregateFileStats = {
            collectorCount: this.config.collectorCount,
            collectorIndex: this.collectorIndex,
            fromTime: partitionKey.fromTime.toUTCString(),
            toTime: partitionKey.untilTime.toUTCString(),
            partitionKey: partitionKey.toString(),
            eventCount: objects.length,
            files: writeStats,
        }
        this.messageBus.publish('stats', statsEvent);
    }

}