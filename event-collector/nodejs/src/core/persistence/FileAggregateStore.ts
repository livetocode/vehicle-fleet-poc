import { AggregateStore } from "./AggregateStore.js";
import fs from 'fs/promises';
import { DataPartitionStats, Logger, Stopwatch, TimeRange, dateToUtcParts } from "core-lib";
import path from 'path';
import { FileWriter } from "./formats/FileWriter.js";
import { pathToFileURL } from 'node:url';

export class FileAggregateStore<T> implements AggregateStore<T> {
    constructor(
        private logger: Logger,
        private folder: string, 
        private flatLayout: boolean,
        private formats: FileWriter[]
    ) {}

    async init(): Promise<void> {        
        await fs.mkdir(this.folder, { recursive: true });
    }

    async write(range: TimeRange, partitionKey: string, events: T[]): Promise<DataPartitionStats[]> {
        const stats: DataPartitionStats[] = [];
        for (const format of this.formats) {
            const ext = format.extension;
            const fromParts = dateToUtcParts(range.fromTime);
            let filename: string;
            if (this.flatLayout) {
                filename = path.join(
                    this.folder,
                    `${fromParts.join('-')}-${partitionKey}.${ext}`);
            } else {
                filename = path.join(
                    this.folder, 
                    ext,
                    ...fromParts,
                    `${fromParts.join('-')}-${partitionKey}.${ext}`);    
            }
            if (this.flatLayout === false) {
                await fs.mkdir(path.dirname(filename), { recursive: true });
            }
            try {
                await fs.access(filename);
                this.logger.warn(`file ${filename} already exists!`);
            } catch {
                const watch = new Stopwatch();
                watch.start();
                await format.write(filename, events);
                watch.stop();
                const fstats = await fs.stat(filename);
                stats.push({
                    url: pathToFileURL(filename).toString(),
                    format: ext,
                    size: fstats.size,
                    itemCount: events.length,
                    partitionKey: partitionKey,
                    elapsedTimeInMS: watch.elapsedTimeInMS(),
                });
            }    
        }
        return stats;
    }

}
