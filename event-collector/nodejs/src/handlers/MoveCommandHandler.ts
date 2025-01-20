import { Config, FlushRequest, MessageHandler, Logger, MoveCommand, computeHashNumber, IncomingMessageEnvelope } from 'core-lib';
import { EventStore, StoredEvent } from "../core/persistence/EventStore.js";
import { DataPartitionStrategy } from "../core/data/DataPartitionStrategy.js";
import { GeohashDataPartitionStrategy } from "../core/data/GeohashDataPartitionStrategy.js";
import { MoveCommandAccumulator, PersistedMoveCommand } from "./MoveCommandAccumulator.js";

export class MoveCommandHandler extends MessageHandler<MoveCommand> {
    private geohashPartitioner: GeohashDataPartitionStrategy;

    constructor(
        private config: Config,
        private logger: Logger,
        private eventStore: EventStore<PersistedMoveCommand>,
        private accumulator: MoveCommandAccumulator,
        private dataPartitionStrategy: DataPartitionStrategy<MoveCommand>,
        private collectorIndex: number,
    ) {
        super();
        this.geohashPartitioner = new GeohashDataPartitionStrategy(config.collector.geohashLength);
    }

    get messageTypes(): string[] {
        return ['move']; 
    }

    async init(): Promise<void> {
        await this.restore();
    }

    async process(msg: IncomingMessageEnvelope<MoveCommand>): Promise<void> {
        const event = msg.body;
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
