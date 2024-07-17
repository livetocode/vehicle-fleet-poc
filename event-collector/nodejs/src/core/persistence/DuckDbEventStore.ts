import { Database, Statement } from "duckdb-async";
import { EventStore, StoredEvent } from "./EventStore.js";

export class DuckDbEventStore<T> implements EventStore<T> {
    private _db?: Database;
    private _insertStatement?: Statement;
    private _deleteStatement?: Statement;
    private _selectStatement?: Statement;

    async init(): Promise<void> {
        const db = await Database.create(":memory:");
        this._db = db;
        await db.run(`CREATE TABLE events (
            timestamp TIMESTAMP,
            partitionKey VARCHAR,
            collectorIndex INTEGER,
            event JSON
        )`);
        await db.run('CREATE INDEX events_idx ON events (timestamp);');
        this._insertStatement = await db.prepare(`INSERT INTO events (timestamp, partitionKey, collectorIndex, event) VALUES (?, ?, ?, ?)`);
        this._deleteStatement = await db.prepare(`DELETE FROM events WHERE timestamp < ?::TIMESTAMP and collectorIndex = ?::INTEGER`);
        this._selectStatement = await db.prepare(`
            SELECT timestamp, partitionKey, collectorIndex, event 
            FROM events 
            WHERE collectorIndex = ?::INTEGER 
            ORDER BY timestamp
            OFFSET ?::INTEGER 
            LIMIT 10000
        `);
    }

    async write(event: StoredEvent<T>): Promise<void> {
        await this._insertStatement?.run(event.timestamp, event.partitionKey, event.collectorIndex, JSON.stringify(event.event));
        await this._insertStatement?.finalize();
    }

    async *fetch(collectorIndex?: number): AsyncGenerator<StoredEvent<T>[], any, unknown> {
        if (this._selectStatement) {
            let offset = 0;
            while(true) {
                const data = await this._selectStatement?.all(collectorIndex ?? 0, offset);
                if (data.length > 0) {
                    yield data.map(row => (
                        {
                            timestamp: row.timestamp,
                            partitionKey: row.partitionKey,
                            collectorIndex: row.collectorIndex,
                            event: JSON.parse(row.event),
                        }
                    ));
                    offset += data.length;
                } else {
                    break;
                }
            }
        }
    }

    async delete(untilTimestamp: Date, collectorIndex?: number): Promise<void> {
        await this._deleteStatement?.run(untilTimestamp, collectorIndex ?? 0);
        await this._deleteStatement?.finalize();
    }
}