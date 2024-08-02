export abstract class DataPartitionStrategy<T> {
    abstract getPartitionKey(entity: T): string;
}
