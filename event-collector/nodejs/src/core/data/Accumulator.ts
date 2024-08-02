import { Logger } from "core-lib";
import { Comparable } from "core-lib";

export abstract class Accumulator<TObject, TPartitionKey extends Comparable> {
    private objects: TObject[] = [];
    private activePartitionKey: TPartitionKey | undefined;
    private totalAccumulated = 0;
    private totalPartitions = 0;

    constructor(protected logger: Logger) {}

    async write(obj: TObject): Promise<void> {
        const partitionKey = this.getPartitionKey(obj);
        // TODO: allow to flush when activePartition changes or when event buffer has reached a limit
        if (this.activePartitionKey && this.activePartitionKey.compareTo(partitionKey) !== 0) {
            await this.flush();
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
            await this.persistObjects(this.objects, this.activePartitionKey);
            this.logger.debug(`Flush complete. ${this.totalAccumulated} entries accumulated in ${this.totalPartitions} partitions.`);
        }
        this.objects = [];
        this.activePartitionKey = undefined;
}

    protected abstract getPartitionKey(obj: TObject): TPartitionKey;
    protected abstract persistObjects(objects: TObject[], partitionKey: TPartitionKey): Promise<void>;
}