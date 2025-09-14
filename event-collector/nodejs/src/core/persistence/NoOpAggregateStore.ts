import { TimeRange, DataPartitionStats } from "core-lib";
import { AggregateStore } from "./AggregateStore.js";

export class NoOpAggregateStore<T> implements AggregateStore<T> {
    async write(range: TimeRange, partitionKey: string, sequence: number, events: T[]): Promise<DataPartitionStats[]> {
        return [];
    }
}