import { AggregateStore } from "./AggregateStore.js";
import fs from 'fs/promises';
import { FileWriteStats, Logger, TimeRange, dateToUtcParts } from "core-lib";
import path from 'path';
import { FileWriter } from "./formats/FileWriter.js";

export class FileAggregateStore<T> implements AggregateStore<T> {
    constructor(
        private logger: Logger,
        private folder: string, 
        private formats: FileWriter[]
    ) {}

    async init(): Promise<void> {        
        await fs.mkdir(this.folder, { recursive: true });
    }

    async write(range: TimeRange, partitionKey: string, events: T[]): Promise<FileWriteStats[]> {
        const stats: FileWriteStats[] = [];
        for (const format of this.formats) {
            const ext = format.extension;
            const fromParts = dateToUtcParts(range.fromTime);
            const filename = path.join(
                this.folder, 
                ext,
                ...fromParts,
                `${partitionKey}.${ext}`);
            await fs.mkdir(path.dirname(filename), { recursive: true });
            try {
                await fs.access(filename);
                this.logger.warn(`file ${filename} already exists!`);
            } catch {
                await format.write(filename, events);
                const fstats = await fs.stat(filename);
                stats.push({
                    filename,
                    format: ext,
                    size: fstats.size,
                    itemCount: events.length,
                    partitionKey: partitionKey,
                });
            }    
        }
        return stats;
    }

}
