import { ConsoleLogger, NoopLogger, type Logger, type LoggingConfig } from "core-lib";

export function createLogger(config: LoggingConfig, name: string): Logger {
    if (!config.enabled) {
        return new NoopLogger();
    }
    return new ConsoleLogger(name, config.level);
}