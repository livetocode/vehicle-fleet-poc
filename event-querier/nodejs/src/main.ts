import fs from 'fs';
import YAML from 'yaml';
import { Config, ConsoleLogger, Logger, NoopLogger, LoggingConfig } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import { VehicleQueryHandler } from './handlers/VehicleQueryHandler.js';

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    const result: Config = YAML.parse(file);
    const instances = process.env.QUERIER_INSTANCES;
    if (instances && parseInt(instances) > 0) {
        result.querier.instances = parseInt(instances);
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
    const querierIndex = parseInt(process.env.QUERIER_INDEX || '0');
    const logger =  createLogger(config.querier.logging, `Querier #${querierIndex}`);

    const messageBus = createMessageBus(config.hub, 'querier', logger);
    await messageBus.start();
    
    const vehicleQueryHandler = new VehicleQueryHandler(
        config,
        logger,
        messageBus, 
    );
    messageBus.registerHandlers(vehicleQueryHandler);

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.querier.httpPort, logger, 'querier');
    if (config.querier.parallelSearch) {
        messageBus.watch(`query.vehicles.partitions`, 'vehicle-querier-partitions').catch(console.error);
        messageBus.watch(messageBus.privateInboxName).catch(console.error);
    }    
    await messageBus.watch(`query.vehicles`, 'vehicle-querier');
    server.close();
}

main().catch(console.error);
