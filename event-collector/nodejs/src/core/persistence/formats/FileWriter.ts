export abstract class FileWriter {
    abstract get extension(): string;
    abstract init(): Promise<void>;
    abstract write(filename: string, data: any[]): Promise<void>;
}
