import { DataFrame, readParquet, readCSV, readJSON, readIPC } from "nodejs-polars";

export type DataFrameFormat = 'parquet' | 'csv' | 'json' | 'arrow';

export interface DataFrameDescriptor {
    name: string;
    size: number;
    format: DataFrameFormat;
}

export interface ListOptions {
    fromPrefix: string;
    toPrefix: string;
    format: DataFrameFormat;
    subFolder?: string;
}

export interface DataFrameRepository {
    init(): Promise<void>;
    clear(): Promise<void>;
    list(options: ListOptions): AsyncGenerator<DataFrameDescriptor>;
    exists(name: string): Promise<boolean>;
    read(name: string): Promise<DataFrame>;
    write(df: DataFrame, name: string): Promise<DataFrameDescriptor>;
}

export function stringToFormat(value: string): DataFrameFormat {
    if (value === 'parquet') {
        return 'parquet';
    }
    if (value === 'csv') {
        return 'csv';
    }
    if (value === 'json') {
        return 'json';
    }
    if (value === 'arrow') {
        return 'arrow';
    }
    throw new Error(`Unknownformat '${value}'`);
}

export function detectFormat(name: string) : DataFrameFormat {
    if (name.endsWith('.parquet')) {
        return 'parquet';
    }
    if (name.endsWith('.csv')) {
        return 'csv';
    }
    if (name.endsWith('.json')) {
        return 'json';
    }
    if (name.endsWith('.arrow')) {
        return 'arrow';
    }
    throw new Error(`Could not detect format of '${name}'`);
}

export function dataframeToBuffer(df: DataFrame, format: DataFrameFormat): Buffer {
    if (format === 'parquet') {
        return df.writeParquet({ compression: 'snappy' });
    }
    if (format === 'csv') {
        return df.writeCSV();
    }
    if (format === 'json') {
        return df.writeJSON();
    }
    if (format === 'arrow') {
        return df.writeIPC();
    }
    throw new Error(`Unknown format '${format}'`);
}

export function bufferToDataframe(buffer: Buffer, format: DataFrameFormat): DataFrame {
    if (format === 'parquet') {
        return readParquet(buffer);
    }
    if (format === 'csv') {
        return readCSV(buffer);
    }
    if (format === 'json') {
        return readJSON(buffer);
    }
    if (format === 'arrow') {
        return readIPC(buffer);
    }
    throw new Error(`Unknown format '${format}'`);
}

export function findCommonRoot(a: string, b: string): string {
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
        if (a[i] != b[i]) {
            return a.slice(0, i);
        }
    }
    return a.slice(0, minLen);
}