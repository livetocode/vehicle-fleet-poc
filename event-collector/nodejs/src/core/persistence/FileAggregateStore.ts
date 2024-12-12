import { AggregateStore } from "./AggregateStore.js";
import { DataPartitionStats, Logger, Stopwatch, TimeRange, dateToUtcParts } from "core-lib";
import path from 'path';
import { pathToFileURL } from 'node:url';
import { DataFrameFormat, DataFrameRepository } from "data-lib";
import { DataFrame } from "nodejs-polars";

export class FileAggregateStore<T> implements AggregateStore<T> {
    constructor(
        private logger: Logger,
        private overwriteExistingFiles: boolean,
        private flatLayout: boolean,
        private formats: DataFrameFormat[],
        private repo: DataFrameRepository,
    ) {}

    async write(range: TimeRange, partitionKey: string, events: T[]): Promise<DataPartitionStats[]> {
        const stats: DataPartitionStats[] = [];
        for (const format of this.formats) {
            const fromParts = dateToUtcParts(range.fromTime);
            let filename: string;
            if (this.flatLayout) {
                filename = `${fromParts.join('-')}-${partitionKey}.${format}`;
            } else {
                filename = path.join(
                    ...fromParts,
                    `${fromParts.join('-')}-${partitionKey}.${format}`);    
            }
            if (this.overwriteExistingFiles === false && await this.repo.exists(filename)) {
                this.logger.warn(`file ${filename} already exists!`);
            } else {
                const watch = new Stopwatch();
                watch.start();
                const df = DataFrame(events, { inferSchemaLength: 1 });
                const item = await this.repo.write(df, filename);
                watch.stop();
                stats.push({
                    url: pathToFileURL(filename).toString(),
                    format,
                    size: item.size,
                    itemCount: events.length,
                    partitionKey: partitionKey,
                    elapsedTimeInMS: watch.elapsedTimeInMS(),
                });
            }    
        }
        return stats;
    }

}
