import { TimeRange } from "core-lib";

export interface StoredEvent<T> {
    timestamp: Date;
    partitionKey: string;
    collectorIndex: number;
    event: T;
}

export interface EventStore<T> {
    init(): Promise<void>;
    write(event: StoredEvent<T>): Promise<void>;
    fetch(collectorIndex?: number): AsyncGenerator<StoredEvent<T>[]>;
    delete(range: TimeRange, collectorIndex?: number): Promise<void>;
}
