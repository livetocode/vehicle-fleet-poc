import { FileWriter } from "./FileWriter.js";
import fs from 'fs/promises';
import { tableFromJSON, tableToIPC } from 'apache-arrow';

export class ArrowFileWriter extends FileWriter {
    get extension(): string {
        return 'arrow';
    }

    init(): Promise<void> {
        return Promise.resolve();
    }

    async write(filename: string, data: any[]): Promise<void> {
        const arrowTable = tableFromJSON(data);
        await fs.writeFile(filename, tableToIPC(arrowTable, 'file'));
    }
}