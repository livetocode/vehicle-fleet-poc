import { AggregateStore } from "./AggregateStore.js";
import { DataPartitionStats, Logger, Stopwatch, TimeRange, dateToUtcParts, dateToUtcPartsAsAttributes } from "core-lib";
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

    async write(range: TimeRange, partitionKey: string, sequence: number, events: T[]): Promise<DataPartitionStats[]> {
        const stats: DataPartitionStats[] = [];
        for (const format of this.formats) {
            const fromParts = dateToUtcParts(range.fromTime);
            const attributes = { 
                start: fromParts.join('-'),
                int: range.interval / 1000, // in seconds
                pk: partitionKey, 
                seq: sequence 
            };
            let fullpath: string;
            // 2024-01-01-05-00-f25ks-0.parquet
            const filename = `${fromParts.join('-')}-${partitionKey}-${sequence}.${format}`;
            if (this.flatLayout) {
                fullpath = filename;
            } else {
                const folderAttributes = {
                    ...dateToUtcPartsAsAttributes(range.fromTime),
                    start: fromParts.join('-'),
                    int: range.interval / 1000, // in seconds
                    pk: partitionKey,
                }
                const folders = attributesAsArray(folderAttributes);
                // y=2024/m=01/d=01/hh=05/mm=00/start=2024-01-01-05-00/int=600/pk=f25ks/2024-01-01-05-00-f25ks-0.parquet
                fullpath = path.join(...folders, filename);
            }
            if (this.overwriteExistingFiles === false && await this.repo.exists(fullpath)) {
                this.logger.warn(`file ${fullpath} already exists!`);
            } else {
                const watch = new Stopwatch();
                watch.start();
                const df = DataFrame(events, { inferSchemaLength: 1 });
                const item = await this.repo.write(df, fullpath);
                watch.stop();
                stats.push({
                    url: pathToFileURL(fullpath).toString(),
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

function attributesAsArray(attributes: Record<string, any>): string[] {
    // ['start=2025-10-01-12-10', 'int=600', 'pk=ewrr0z', 'seq=2']
    return Object.entries(attributes)
        .map(([key, value]) => `${key}=${value}`)
}
