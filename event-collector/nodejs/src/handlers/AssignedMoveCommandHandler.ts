import { Config, MessageHandler, Logger, MoveCommand, EnrichedMoveCommand, computeHashNumber, IncomingMessageEnvelope } from 'core-lib';
import { EventStore, StoredEvent } from "../core/persistence/EventStore.js";
import { DataPartitionStrategy } from "../core/data/DataPartitionStrategy.js";
import { GeohashDataPartitionStrategy } from "../core/data/GeohashDataPartitionStrategy.js";
import { MoveCommandAccumulator, PersistedMoveCommand } from "./MoveCommandAccumulator.js";

export class AssignedMoveCommandHandler extends MessageHandler<EnrichedMoveCommand> {

    constructor(
        private logger: Logger,
        private eventStore: EventStore<PersistedMoveCommand>,
        private accumulator: MoveCommandAccumulator,
        private collectorIndex: number,
    ) {
        super();
    }

    get description(): string {
        return `Dedicated collector that will accumulate events for its assigned partition key.`;
    }

    get messageTypes(): string[] {
        return ['enriched-move']; 
    }

    async init(): Promise<void> {
        await this.restore();
    }

    async process(msg: IncomingMessageEnvelope<EnrichedMoveCommand>): Promise<void> {
        const event = msg.body;
        const dataPartitionKey = event.partitionKey;
        const collectorIndex = event.collectorIndex;
        if (this.collectorIndex !== collectorIndex) {
            this.logger.warn(`Received event for wrong collector index #${collectorIndex}`);
            return;
        }
        this.logger.trace(event);
        const geoHash = event.geoHash;
        const cmd = event.command;
        const storedEvent: StoredEvent<PersistedMoveCommand> = { 
            timestamp: new Date(event.command.timestamp), 
            partitionKey: dataPartitionKey, 
            collectorIndex,
            event: {
                timestamp: new Date(event.command.timestamp),
                vehicleId: cmd.vehicleId,
                vehicleType: cmd.vehicleType,
                gps_lat: cmd.gps.lat,
                gps_lon: cmd.gps.lon,
                gps_alt: cmd.gps.alt,
                geoHash,
                speed: cmd.speed,
                direction: cmd.direction,
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
