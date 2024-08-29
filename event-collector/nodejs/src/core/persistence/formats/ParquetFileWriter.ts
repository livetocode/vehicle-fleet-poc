import { FileWriter } from "./FileWriter.js";
import pl from 'nodejs-polars';

export class ParquetFileWriter extends FileWriter {

    get extension(): string {
        return 'parquet';
    }

    async write(filename: string, data: any[]): Promise<void> {
        const df = pl.DataFrame(data, { inferSchemaLength: 1 });
        df.writeParquet(filename, { compression: 'snappy' });
    }
}



