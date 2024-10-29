import { TimeRange } from "core-lib";
import { EventStore, StoredEvent } from "./EventStore.js";

export class NoOpEventStore<T> implements EventStore<T> {

    init(): Promise<void> {
        return Promise.resolve();
    }

    async write(event: StoredEvent<T>): Promise<void> {
    }

    async *fetch(collectorIndex?: number): AsyncGenerator<StoredEvent<T>[], any, unknown> {
    }

    async delete(range: TimeRange, collectorIndex?: number): Promise<void> {
    }
}