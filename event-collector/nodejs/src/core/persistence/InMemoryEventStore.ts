import { TimeRange } from "core-lib";
import { EventStore, StoredEvent } from "./EventStore.js";

export class InMemoryEventStore<T> implements EventStore<T> {
    private _events: StoredEvent<T>[] = [];

    init(): Promise<void> {
        return Promise.resolve();
    }

    async write(event: StoredEvent<T>): Promise<void> {
        this._events.push(event)
    }

    async *fetch(collectorIndex?: number): AsyncGenerator<StoredEvent<T>[], any, unknown> {
        const result = this._events.filter(ev => this.isMatchingRecord(ev, undefined, collectorIndex));
        result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        yield result;
    }

    async delete(range: TimeRange, collectorIndex?: number): Promise<void> {
        this._events = this._events.filter(ev => !this.isMatchingRecord(ev, range, collectorIndex));
    }

    private isMatchingRecord(event: StoredEvent<T>, range?: TimeRange, collectorIndex?: number) {
        const isTimestampInRange = range === undefined || range.includes(event.timestamp);
        const isMatchingCollector = collectorIndex === undefined || event.collectorIndex === collectorIndex;
        return isTimestampInRange && isMatchingCollector;
    }

}