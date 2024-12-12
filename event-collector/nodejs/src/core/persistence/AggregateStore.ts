import { DataPartitionStats, TimeRange } from "core-lib";

export interface AggregateStore<T> {
    write(range: TimeRange, partitionKey: string, events: T[]): Promise<DataPartitionStats[]>;
}