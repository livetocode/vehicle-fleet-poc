import { FileWriter } from "./FileWriter.js";
import pl from 'nodejs-polars';

export class ArrowFileWriter extends FileWriter {
    get extension(): string {
        return 'arrow';
    }

    async write(filename: string, data: any[]): Promise<void> {
        const df = pl.DataFrame(data, { inferSchemaLength: 1 });
        df.writeIPC(filename);
    }
}