import { FileWriter } from "./FileWriter.js";
import { Database } from "duckdb-async";
import { tableFromJSON, tableToIPC } from 'apache-arrow';

export class ParquetFileWriter extends FileWriter {
    private _db?: Database;

    get extension(): string {
        return 'parquet';
    }

    async init(): Promise<void> {
        this._db = await Database.create(":memory:");
        await this._db.run('INSTALL arrow; LOAD arrow;');
    }

    async write(filename: string, data: any[]): Promise<void> {
        const arrowTable = tableFromJSON(data);
        await this._db?.register_buffer("jsonDataTable", [tableToIPC(arrowTable)], true);    
        try {
            await this._db?.run(`
                COPY
                    (SELECT * FROM jsonDataTable)
                TO '${filename}'
                    (FORMAT 'parquet');
            `);
            //  COMPRESSION 'zstd', ROW_GROUP_SIZE 100_000
            // , CODEC 'snappy'
        } finally {
            await this._db?.unregister_buffer('jsonDataTable');
        }
    }
}



