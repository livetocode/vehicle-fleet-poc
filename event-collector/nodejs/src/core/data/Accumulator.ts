import { Logger } from "core-lib";
import { Comparable } from "core-lib";

export abstract class Accumulator<TObject, TPartitionKey extends Comparable> {
    private objects: TObject[] = [];
    private activePartitionKey: TPartitionKey | undefined;
    private totalAccumulated = 0;
    private totalPartitions = 0;
    private totalPartialPartitions = 0;
    private partialFlushCounter = 0;

    constructor(protected logger: Logger, protected maxCapacity: number) {}

    async write(obj: TObject): Promise<void> {
        const partitionKey = this.getPartitionKey(obj);
        const didPartitionKeyChange = this.activePartitionKey && this.activePartitionKey.compareTo(partitionKey) !== 0;
        const didWeExceedCapacity = this.maxCapacity > 0 && this.objects.length >= this.maxCapacity;
        if (didPartitionKeyChange) {
            await this.flush();
        } else if (didWeExceedCapacity) {
            await this.partialFlush();
        }
        this.activePartitionKey = partitionKey;
        this.objects.push(obj);
        this.totalAccumulated += 1;
    }

    async flush(): Promise<void> {
        if (this.objects.length > 0 && this.activePartitionKey) {
            this.totalPartitions += 1;
            const partitionKeyName = this.activePartitionKey.toString();
            this.logger.debug(`Flushing partition '${partitionKeyName}' containing ${this.objects.length} entries.`);
            await this.persistObjects(this.objects, this.activePartitionKey, false, this.partialFlushCounter);
            this.logger.debug(`Flush complete. ${this.totalAccumulated} entries accumulated in ${this.totalPartitions} partitions.`);
        }
        this.objects = [];
        this.activePartitionKey = undefined;
        this.partialFlushCounter = 0;
    }

    async partialFlush(): Promise<void> {
        if (this.objects.length > 0 && this.activePartitionKey) {
            this.totalPartitions += 1;
            this.totalPartialPartitions += 1;
            const partitionKeyName = this.activePartitionKey.toString();
            this.logger.debug(`Partial flushing partition '${partitionKeyName}' containing ${this.objects.length} entries.`);
            await this.persistObjects(this.objects, this.activePartitionKey, true, this.partialFlushCounter);
            this.logger.debug(`Partial flush complete. ${this.totalPartialPartitions} partial partitions.`);
            this.partialFlushCounter += 1;
        }
        this.objects = [];
    }

    protected abstract getPartitionKey(obj: TObject): TPartitionKey;
    protected abstract persistObjects(objects: TObject[], partitionKey: TPartitionKey, isPartial: boolean, partialFlushSequence: number): Promise<void>;
}