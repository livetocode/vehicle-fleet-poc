import { DataPartitionStats, TimeRange } from "core-lib";

export interface AggregateStore<T> {
    write(range: TimeRange, partitionKey: string, sequence: number, events: T[]): Promise<DataPartitionStats[]>;
}