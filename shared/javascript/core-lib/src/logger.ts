import { LogLevel } from "./config.js";

export interface Logger {
    trace(...args: any[]): void;
    debug(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    error(...args: any[]): void;
}

const levelToIndex = {
    'error': 100,
    'warn':   75,
    'info':   50,
    'debug':  25,
    'trace':  10,
}

export class ConsoleLogger implements Logger {
    private level: number;

    constructor(private name: string, level: LogLevel) {
        this.level = levelToIndex[level];
    }

    trace(...args: any[]): void {
        if (levelToIndex.trace >= this.level) {
            console.debug(new Date(), `[${this.name}] [TRACE]`, ...args);
        }
    }

    debug(...args: any[]): void {
        if (levelToIndex.debug >= this.level) {
            console.debug(new Date(), `[${this.name}] [DEBUG]`, ...args);
        }
    }

    warn(...args: any[]): void {
        if (levelToIndex.warn >= this.level) {
            console.warn(new Date(), `[${this.name}] [WARN]`, ...args);
        }
    }

    info(...args: any[]): void {
        if (levelToIndex.info >= this.level) {
            console.info(new Date(), `[${this.name}] [INFO]`, ...args);
        }
    }

    error(...args: any[]): void {
        if (levelToIndex.error >= this.level) {
            console.error(new Date(), `[${this.name}] [ERROR]`, ...args);
        }
    }
}

export class NoopLogger implements Logger {
    trace(...args: any[]): void {
    }
    debug(...args: any[]): void {
    }
    warn(...args: any[]): void {
    }
    info(...args: any[]): void {
    }
    error(...args: any[]): void {
    }
}