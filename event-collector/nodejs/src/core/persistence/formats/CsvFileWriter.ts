import { FileWriter } from "./FileWriter.js";
import pl from 'nodejs-polars';

export class CsvFileWriter extends FileWriter {

    get extension(): string {
        return 'csv';
    }

    async write(filename: string, data: any[]): Promise<void> {
        const df = pl.DataFrame(data, { inferSchemaLength: 1 });
        df.writeCSV(filename, { sep: ',', includeBom: true });
    }
}
