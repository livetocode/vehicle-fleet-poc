import fs from 'fs';
import YAML from 'yaml';
import { Config, ConsoleLogger, Logger, NoopLogger, LoggingConfig } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import { VehicleQueryHandler } from './handlers/VehicleQueryHandler.js';

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    const result: Config = YAML.parse(file);
    const instances = process.env.FINDER_INSTANCES;
    if (instances && parseInt(instances) > 0) {
        result.finder.instances = parseInt(instances);
    }
    return result;
}

function createLogger(logging: LoggingConfig, name: string): Logger {
    if (!logging.enabled) {
        return new NoopLogger();
    }
    return new ConsoleLogger(name, logging.level);
}

async function main() {
    const config = loadConfig('../../config.yaml');    
    const finderIndex = parseInt(process.env.FINDER_INDEX || '0');
    const logger =  createLogger(config.finder.logging, `Finder #${finderIndex}`);

    const messageBus = createMessageBus(config.hub, 'finder', logger);
    await messageBus.start();
    
    const vehicleQueryHandler = new VehicleQueryHandler(
        config,
        logger,
        messageBus, 
    );
    messageBus.registerHandlers(vehicleQueryHandler);

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.finder.httpPort, logger, 'finder');
    if (config.finder.parallelSearch) {
        messageBus.watch(`query.vehicles.partitions`, 'vehicle-finder-partitions').catch(console.error);
        messageBus.watch(messageBus.privateInboxName).catch(console.error);
    }    
    await messageBus.watch(`query.vehicles`, 'vehicle-finder');
    server.close();
}

main().catch(console.error);
