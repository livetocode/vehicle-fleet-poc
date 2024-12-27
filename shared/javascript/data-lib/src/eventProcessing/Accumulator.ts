import { Logger } from "core-lib";
import { Comparable } from "core-lib";

interface Partition<TObject, TPartitionKey extends Comparable> {
    partitionKey: TPartitionKey;
    objects: TObject[];
    partialFlushCounter: number;
}

export abstract class Accumulator<TObject, TPartitionKey extends Comparable> {
    private partitions: Partition<TObject, TPartitionKey>[] = [];
    private totalAccumulated = 0;
    private totalPartitions = 0;
    private totalPartialPartitions = 0;
    protected totalRejectedMessagesInThePast = 0;
    protected totalRejectedMessagesInTheFuture = 0;
    protected firstEventReceivedAt?: Date;

    constructor(protected logger: Logger, protected maxCapacity: number, protected maxActivePartitions: number) {}

    async write(obj: TObject): Promise<void> {
        if (!this.firstEventReceivedAt) {
            this.firstEventReceivedAt = new Date();
        }
        const partitionKey = this.getPartitionKey(obj);
        let partition = this.findPartition(partitionKey);
        if (!partition) {
            const maxValidPartitionKey = this.getMaxValidPartitionKey();
            if (partitionKey.compareTo(maxValidPartitionKey) >= 0) {
                // Ignore events that arrive too earlier (we allow now + aggregationPeriodInMin only)
                this.totalRejectedMessagesInTheFuture += 1;
                this.logger.debug(`Object is in the future: ${partitionKey} should not exceed ${maxValidPartitionKey}`);
                return;
            }
            while (this.partitions.length >= this.maxActivePartitions) {
                const oldestPartition = this.findOldestPartition();
                if (oldestPartition) {
                    if (partitionKey.compareTo(oldestPartition.partitionKey) < 0) {
                        // Ignore events that arrive too late (we keep 2 active partitions only)
                        this.totalRejectedMessagesInThePast += 1;
                        this.logger.debug(`Object is too late: ${partitionKey} is older than oldest active partition ${oldestPartition.partitionKey}`);
                        return;
                    }
                    await this.flushPartition(oldestPartition);
                    this.removePartition(oldestPartition);
                }
            }
            partition = {
                partitionKey,
                objects: [],
                partialFlushCounter: 0,
            }
            this.addPartition(partition);
        }
        const didWeExceedCapacity = this.maxCapacity > 0 && partition.objects.length >= this.maxCapacity;
        if (didWeExceedCapacity) {
            await this.partialFlushPartition(partition);
        }
        partition.objects.push(obj);
        this.totalAccumulated += 1;
    }

    async flush(): Promise<void> {
        // use reverse order in order to process oldest partitions first.
        for (let i = this.partitions.length - 1; i >= 0; i--) {
            const partition = this.partitions[i];
            await this.flushPartition(partition);
        }
        this.partitions = [];
        this.totalAccumulated = 0;
        this.totalPartitions = 0;
        this.totalPartialPartitions = 0;
        this.totalRejectedMessagesInThePast = 0;
        this.totalRejectedMessagesInTheFuture = 0;
        this.firstEventReceivedAt = undefined;
    }

    private async flushPartition(partition: Partition<TObject, TPartitionKey>) {
        if (partition.objects.length > 0) {
            const partitionKeyName = partition.partitionKey.toString();
            this.logger.debug(`Flushing partition '${partitionKeyName}' containing ${partition.objects.length} entries.`);
            await this.persistObjects(partition.objects, partition.partitionKey, false, partition.partialFlushCounter);
            this.totalPartitions += 1;
            this.totalRejectedMessagesInThePast = 0;
            this.totalRejectedMessagesInTheFuture = 0;
            this.logger.debug(`Flush complete. ${this.totalAccumulated} entries accumulated in ${this.totalPartitions} partitions.`);
        }

    }

    private async partialFlushPartition(partition: Partition<TObject, TPartitionKey>): Promise<void> {
        if (partition.objects.length > 0) {
            const partitionKeyName = partition.partitionKey.toString();
            this.logger.debug(`Partial flushing partition '${partitionKeyName}' containing ${partition.objects.length} entries.`);
            await this.persistObjects(partition.objects, partition.partitionKey, true, partition.partialFlushCounter);
            this.totalPartitions += 1;
            this.totalPartialPartitions += 1;
            this.totalRejectedMessagesInThePast = 0;
            this.totalRejectedMessagesInTheFuture = 0;
            this.logger.debug(`Partial flush complete. ${this.totalPartialPartitions} partial partitions.`);
            partition.partialFlushCounter += 1;
            partition.objects = [];
        }
    }

    private findPartition(key: TPartitionKey): Partition<TObject, TPartitionKey> | undefined {
        return this.partitions.find((partition) => partition.partitionKey.compareTo(key) === 0);
    }

    private findOldestPartition(): Partition<TObject, TPartitionKey> | undefined {
        return this.partitions[this.partitions.length - 1];
    }

    private addPartition(partition: Partition<TObject, TPartitionKey>) {
        this.partitions.push(partition);
        this.partitions.sort((a, b) => - a.partitionKey.compareTo(b.partitionKey)); // by partition key, in descending order (most recent first)
    }
    
    private removePartition(partition: Partition<TObject, TPartitionKey>) {
        const idx = this.partitions.indexOf(partition);
        if (idx >= 0) {
            this.partitions.splice(idx, 1);
        }
    }

    protected abstract getPartitionKey(obj: TObject): TPartitionKey;
    protected abstract getMaxValidPartitionKey(): TPartitionKey;
    protected abstract persistObjects(objects: TObject[], partitionKey: TPartitionKey, isPartial: boolean, partialFlushSequence: number): Promise<void>;
}