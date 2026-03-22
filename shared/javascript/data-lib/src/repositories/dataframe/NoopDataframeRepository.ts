import { DataFrame } from "nodejs-polars";
import { DataFrameDescriptor, DataFrameRepository, dataframeToBuffer, detectFormat, ListOptions } from "./DataFrameRepository.js";
import { Logger, sleep } from "core-lib";

export class NoopDataframeRepository implements DataFrameRepository {
    constructor(private logger: Logger, private writeDelayInMS: number) {}

    init(): Promise<void> {
        return Promise.resolve();
    }

    clear(): Promise<void> {
        return Promise.resolve();
    }

    list(options: ListOptions): AsyncGenerator<DataFrameDescriptor> {
        return (async function* () {})();
    }

    exists(name: string): Promise<boolean> {
        return Promise.resolve(false);
    }

    read(name: string): Promise<DataFrame> {
        return Promise.reject(new Error(`DataFrame '${name}' not found`));
    }

    async write(df: DataFrame, name: string): Promise<DataFrameDescriptor> {
        const format = detectFormat(name);
        const buffer = dataframeToBuffer(df, format);
        if (this.writeDelayInMS > 0) {
            this.logger.debug(`Simulating write delay of ${this.writeDelayInMS}ms for DataFrame '${name}'...`);
            await sleep(this.writeDelayInMS);
        }
        return {
            name,
            format,
            size: buffer.length,
        };
    }
}
