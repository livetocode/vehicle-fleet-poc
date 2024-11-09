import { ConsoleLogger, Logger } from "core-lib";

export const BEFORE_HTTP_SERVER_PRIORITY = -100;
export const CLOSE_HTTP_SERVER_PRIORITY = 0;
export const AFTER_CLOSE_HTTP_SERVER_PRIORITY = 100;

type GracefulTerminationHandler = () => Promise<void>;

interface GracefulTerminationRegistration {
    name: string;
    priority: number;
    overwrite: boolean;
    handler: GracefulTerminationHandler;
}

export class GracefulTerminationService {
    private _handlers: GracefulTerminationRegistration[] = [];

    constructor(private logger: Logger) {}

    unregister(name: string) {
        const idx = this._handlers.findIndex((reg) => reg.name === name);
        if (idx >= 0) {
            this._handlers.splice(idx, 1);
        }
    }

    register(registration: GracefulTerminationRegistration) {
        const idx = this._handlers.findIndex((reg) => reg.name === registration.name);
        if (idx >= 0) {
            if (registration.overwrite) {
                this.logger.debug(
                    {},
                    `Graceful termination handler "${registration.name}" is already registered and will be overwritten!`,
                );
                this._handlers[idx] = registration;
            } else {
                throw new Error(
                    `Graceful termination handler "${registration.name}" is already registered!`,
                );
            }
        } else {
            this.logger.debug({}, `Registered graceful termination handler "${registration.name}"`);
            this._handlers.push(registration);
        }
    }

    async invokeHandlers() {
        const handlers = [...this._handlers].sort((a, b) => a.priority - b.priority);
        this._handlers = []; // don't invoke handlers twice since they cleanup resources
        for (const { name, handler } of handlers) {
            this.logger.debug({}, `Invoking graceful termination handler "${name}"`);
            try {
                await handler();
            } catch (err) {
                this.logger.error(err, `While invoking graceful termination handler "${name}"`);
            }
        }
    }
}

/**
 * Reacts to a terminate process event in order to gracefully close pending operations.
 * @param signal the signal emitted by the container orchestrator, to terminate the process.
 * @notes See also these articles for graceful termination: https://blog.risingstack.com/graceful-shutdown-node-js-kubernetes/
 * and https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
 */
export function closeGracefully(
    logger: Logger,
    gracefulTerminationService: GracefulTerminationService,
    processKiller: (pid: number, signal?: string | number) => boolean,
): (signal: string | number) => void {
    return function (signal: string | number): void {
        logger.info({}, `*^!@4=> Received signal to terminate: ${signal}`);
        logger.debug({}, 'Closing application gracefully...');
        gracefulTerminationService
            .invokeHandlers()
            .then(() => {
                logger.debug({}, 'Closed application gracefully.');
            })
            .catch((err) => {
                logger.error(err, 'While invoking graceful termination handlers');
            })
            .finally(() => {
                logger.debug({}, 'Killing process. Bye!!!');
                processKiller(process.pid, signal);
            });
    };
}

const logger = new ConsoleLogger("GracefulTermination", "debug");
export const gracefulTerminationService = new GracefulTerminationService(logger);

process.once('SIGINT', closeGracefully(logger, gracefulTerminationService, process.kill));
process.once('SIGTERM', closeGracefully(logger, gracefulTerminationService, process.kill));
