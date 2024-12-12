import fs from 'fs/promises';
import path from 'path';
import { DataFrame, readCSV, readIPC, readJSON, readParquet } from "nodejs-polars";
import { DataFrameRepository, detectFormat, ListOptions, DataFrameDescriptor } from "./DataFrameRepository.js";
import { Dirent, existsSync } from 'fs';

export class FileDataframeRepository implements DataFrameRepository {
    constructor(private folder: string) {}

    async init(): Promise<void> {
        await fs.mkdir(this.folder, { recursive: true });
    }


    async clear(): Promise<void> {
        await fs.rm(this.folder, { recursive: true, force: true});
        await fs.mkdir(this.folder, { recursive: true });
    }

    async *list(options: ListOptions): AsyncGenerator<DataFrameDescriptor> {
        let dataFolder = path.join(this.folder, options.format);
        if (options.subFolder) {
            dataFolder = path.join(dataFolder, options.subFolder);
        }
        if (existsSync(dataFolder)) {
            for await (const entry of readAllFiles(dataFolder)) {
                const format = detectFormat(entry.file.name);
                if (format === options.format && entry.file.name >= options.fromPrefix && entry.file.name < options.toPrefix) {
                    const directory = removeRootFolder(entry.directory, this.folder);
                    yield {
                        name: path.join(directory, entry.file.name),
                        size: entry.size,
                        format,
                    }
                }
            }    
        }
    }

    async exists(name: string): Promise<boolean> {
        return existsSync(path.join(this.folder, name));
    }

    async read(name: string): Promise<DataFrame> {
        const format = detectFormat(name);
        const filename = path.join(this.folder, name);
        if (format === 'parquet') {
            return readParquet(filename);
        }
        if (format === 'csv') {
            return readCSV(filename);
        }
        if (format === 'json') {
            return readJSON(filename);
        }
        if (format === 'arrow') {
            return readIPC(filename);
        }
        throw new Error(`Unknown format '${format}'`);        
    }

    async write(df: DataFrame, name: string): Promise<DataFrameDescriptor> {        
        const format = detectFormat(name);
        const filename = path.join(this.folder, format, name);
        await fs.mkdir(path.dirname(filename), { recursive: true });
        if (format === 'parquet') {
            df.writeParquet(filename, { compression: 'snappy' });
        } else if (format === 'csv') {
            df.writeCSV(filename);
        } else if (format === 'json') {
            df.writeJSON(filename);
        } else if (format === 'arrow') {
            df.writeIPC(filename);
        } else {
            throw new Error(`Unknown format '${format}'`);
        }
        const fstats = await fs.stat(filename);
        return {
            name,
            format,
            size: fstats.size,
        }
    }
}

export async function *readAllFiles(directory: string): AsyncGenerator<{ file: Dirent; directory: string; size: number }> {
    const files = await fs.readdir(directory, { withFileTypes: true });
    files.sort((a, b) => a.name.localeCompare(b.name));
  
    for (const file of files) {
      if (file.isDirectory()) {
        yield* readAllFiles(path.join(directory, file.name));
      } else {
        const fstats = await fs.stat(path.join(directory, file.name));
        yield { file, directory, size: fstats.size };
      }
    }
}

function removeRootFolder(path: string, root: string) {
    if (path.startsWith(root)) {
        let start = root.length;
        if (path[start] === '/') {
            start += 1;
        }
        return path.substring(start);
    }
    return path;
}