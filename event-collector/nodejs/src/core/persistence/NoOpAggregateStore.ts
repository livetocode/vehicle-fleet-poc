import { TimeRange, DataPartitionStats } from "core-lib";
import { AggregateStore } from "./AggregateStore.js";

export class NoOpAggregateStore<T> implements AggregateStore<T> {
    async init(): Promise<void> {
    }
    async write(range: TimeRange, partitionKey: string, events: T[]): Promise<DataPartitionStats[]> {
        return [];
    }
}