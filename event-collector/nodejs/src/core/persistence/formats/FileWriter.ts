export abstract class FileWriter {
    abstract get extension(): string;
    abstract write(filename: string, data: any[]): Promise<void>;
}
