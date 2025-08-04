import { Logger, EnrichedMoveCommand, IMessageBus, services, Stopwatch, formatBytes, AzureEventHubEventDispatcherConfig, chunks } from "core-lib";
import { EventDataBatch, EventHubProducerClient } from "@azure/event-hubs";

export type EventDispatcher<T> = {
    dispatch(event: T): Promise<void>;
};

export class EventDispatcherProxy<T> implements EventDispatcher<T> {
    constructor(private readonly dispatchers: EventDispatcher<T>[]) {
        if (dispatchers.length === 0) {
            throw new Error('Expected to receive at least one EventDispatcher');
        }
    }

    async dispatch(event: T): Promise<void> {
        const results = await Promise.allSettled(this.dispatchers.map(x => x.dispatch(event)));
        const errors: any[] = [];
        for (const result of results) {
            if (result.status === 'rejected') {
                if (result.reason?.message) {
                    errors.push(result.reason.message);
                } else {
                    errors.push(result.reason);
                }
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors);
        }
    }
}

export type MoveEventDispatcher = EventDispatcher<EnrichedMoveCommand>;

export class MoveEventDispatcherProxy extends EventDispatcherProxy<EnrichedMoveCommand> {}

export class MessageBusMoveEventDispatcher implements MoveEventDispatcher {
    constructor(private readonly messageBus: IMessageBus) {}

    dispatch(event: EnrichedMoveCommand): Promise<void> {
        const path = services.collectors.assigned.publish({ 
            index: event.collectorIndex.toString(), 
            rest: 'commands/move', 
        });
        return this.messageBus.publish(path, event);
    }

}

export class AzureEventHubMoveEventDispatcher implements MoveEventDispatcher {
    private client: EventHubProducerClient;
    private batchesByPartitionKey = new Map<string, EventDataBatch>();

    constructor(private logger: Logger, private config: AzureEventHubEventDispatcherConfig) {
        this.client = new EventHubProducerClient(config.connectionString, { userAgent: 'event-collector' });
        setTimeout(() => {
            this.checkActivity().catch(console.error);
        }, config.sendDelayInMS);
    }

    async dispatch(event: EnrichedMoveCommand): Promise<void> {
        for (let i = 0; i < 5; i++) {
            let batch = this.batchesByPartitionKey.get(event.partitionKey);
            if (!batch) {
                batch = await this.client.createBatch({ partitionKey: event.partitionKey });
                this.batchesByPartitionKey.set(event.partitionKey, batch);
                this.logger.trace(`Added batch for ${event.partitionKey}. Total = ${this.batchesByPartitionKey.size}`);
            }
            const ev = {
                type: event.command.type,
                partitionKey: event.partitionKey,
                collectorIndex: event.collectorIndex,
                vehicleId: event.command.vehicleId,
                vehicleType: event.command.vehicleType,
                zoneId: event.command.zoneId,
                direction: event.command.direction,
                speed: event.command.speed,
                gps_lat: event.command.gps.lat,
                gps_lon: event.command.gps.lon,
                gps_alt: event.command.gps.alt,
                geohash: event.geoHash,
                recordedAt: event.command.timestamp,        
            };
            if (batch.tryAdd({ body: ev })) {
                break;
            } else {
                this.batchesByPartitionKey.delete(event.partitionKey);
                this.logger.trace(`Removed batch for ${event.partitionKey}. Total = ${this.batchesByPartitionKey.size}`);
                this.logger.trace(`Sending batch to Azure for partitionKey ${event.partitionKey}`);
                const batchWatch = Stopwatch.startNew();
                await this.client.sendBatch(batch);
                this.logger.debug(`Sent batch (Size=${batch.sizeInBytes/1024}) to Azure for partitionKey ${event.partitionKey} in ${batchWatch.elapsedTimeAsString()}`);
            }
        }
    }

    private async checkActivity() {
        try {
            await this.doCheckActivity();
        } catch(err: any) {
            this.logger.error(err);
        } finally {
            setTimeout(() => {
                this.checkActivity().catch(console.error);
            }, this.config.sendDelayInMS);
        }
    }

    private async doCheckActivity() {
        const size = this.batchesByPartitionKey.size;
        if (size === 0) {
            return;
        }
        const mainWatch = Stopwatch.startNew();
        const batchesByPartitionKey = this.batchesByPartitionKey;
        this.batchesByPartitionKey = new Map<string, EventDataBatch>();
        this.logger.debug(`Sending ${size} batches to Azure...`);
        let i = 0;
        let chunkIdx = 0;
        let bytes = 0;
        let errors = 0;
        for (const chunk of chunks(batchesByPartitionKey.entries(), this.config.sendParallelism)) {
            chunkIdx += 1;
            this.logger.trace(`Sending chunk #${chunkIdx} of ${chunk.length} batches...`);
            const promises = chunk.map(([partitionKey, batch]) => this.sendBatch(partitionKey, batch, i++, size));
            const results = await Promise.allSettled(promises);
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    bytes += result.value;
                } else {
                    errors += 1;
                }
            }
            this.logger.trace(`Sent chunk #${chunkIdx}`);
        }
        const sizeAsStr = formatBytes(bytes);
        this.logger.debug(`Sent ${size} batches (Size=${sizeAsStr.value} ${sizeAsStr.units}) to Azure in ${mainWatch.elapsedTimeAsString()}`);
    }

    private async sendBatch(partitionKey: string, batch: EventDataBatch, idx: number, size: number) {
        const sizeAsStr = formatBytes(batch.sizeInBytes);
        const batchWatch = Stopwatch.startNew();
        this.logger.trace(`Sending batch ${idx+1} of ${size} to Azure (${partitionKey})`);
        try {
            await this.client.sendBatch(batch);
            this.logger.trace(`Sent batch ${idx+1} of ${size} to Azure (Size=${sizeAsStr.value} ${sizeAsStr.units}, PartitionKey=${partitionKey}) in ${batchWatch.elapsedTimeAsString()}`);
            return batch.sizeInBytes;
        } catch(err: any) {
            this.logger.error(`Could not send batch ${idx+1} of ${size} to Azure (Size=${sizeAsStr.value} ${sizeAsStr.units}, PartitionKey=${partitionKey}) in ${batchWatch.elapsedTimeAsString()}. Error: ${err.message}`);
            return 0;
        }
    }
}
