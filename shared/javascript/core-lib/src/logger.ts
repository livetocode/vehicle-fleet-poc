export interface Logger {
    trace(...args: any[]): void;
    debug(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    error(...args: any[]): void;
}

export class ConsoleLogger implements Logger {
    constructor(private name: string) {}

    trace(...args: any[]): void {
        console.trace(new Date(), `[${this.name}] [TRACE]`, ...args);
    }

    debug(...args: any[]): void {
        console.debug(new Date(), `[${this.name}] [DEBUG]`, ...args);
    }

    warn(...args: any[]): void {
        console.warn(new Date(), `[${this.name}] [WARN]`, ...args);
    }

    info(...args: any[]): void {
        console.info(new Date(), `[${this.name}] [INFO]`, ...args);
    }

    error(...args: any[]): void {
        console.error(new Date(), `[${this.name}] [ERROR]`, ...args);
    }
}