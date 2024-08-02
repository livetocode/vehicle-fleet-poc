import { DataPartitionStats, TimeRange } from "core-lib";

export interface AggregateStore<T> {
    init(): Promise<void>;
    write(range: TimeRange, partitionKey: string, events: T[]): Promise<DataPartitionStats[]>;
}