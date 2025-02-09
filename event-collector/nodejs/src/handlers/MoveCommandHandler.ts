import { Config, MessageHandler, MoveCommand, computeHashNumber, IncomingMessageEnvelope, EnrichedMoveCommand, IMessageBus } from 'core-lib';
import { DataPartitionStrategy } from "../core/data/DataPartitionStrategy.js";
import { GeohashDataPartitionStrategy } from "../core/data/GeohashDataPartitionStrategy.js";

export class MoveCommandHandler extends MessageHandler<MoveCommand> {
    private geohashPartitioner: GeohashDataPartitionStrategy;

    constructor(
        private config: Config,
        private messageBus: IMessageBus,
        private dataPartitionStrategy: DataPartitionStrategy<MoveCommand>,
    ) {
        super();
        this.geohashPartitioner = new GeohashDataPartitionStrategy(config.collector.geohashLength);
    }

    get description(): string {
        return `Receives vehicle positions and dispatch them to dedicated collectors based on the configured partition key.`;
    }

    get messageTypes(): string[] {
        return ['move']; 
    }

    async process(msg: IncomingMessageEnvelope<MoveCommand>): Promise<void> {
        // Enrich the move command by computing a Geohash and a partition key,
        // in order to dispatch the event to a dedicated collector and avoir sharing partitions between collectors
        const event = msg.body;
        const dataPartitionKey = this.dataPartitionStrategy.getPartitionKey(event);
        const collectorIndex = computeHashNumber(dataPartitionKey) % this.config.collector.instances;
        const geoHash = this.geohashPartitioner.getPartitionKey(event);
        const vehicleMovedEvent: EnrichedMoveCommand = { 
            type: 'enriched-move',
            partitionKey: dataPartitionKey, 
            collectorIndex,
            geoHash,
            command: event,
        };
        this.messageBus.publish(`services.collectors.assigned.${collectorIndex}.commands.move`, vehicleMovedEvent);
    }
}
