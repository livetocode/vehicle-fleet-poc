import { FileWriter } from "./FileWriter.js";
import fs from 'fs/promises';

export class JsonFileWriter extends FileWriter {
    constructor(private pretty = false) {
        super();
    }
    
    get extension(): string {
        return 'json';
    }

    async write(filename: string, data: any[]): Promise<void> {
        const text = this.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        await fs.writeFile(filename, text, 'utf8');    
    }
}