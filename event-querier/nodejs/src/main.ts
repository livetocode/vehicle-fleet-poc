import fs from 'fs';
import YAML from 'yaml';
import { Config, ConsoleLogger, Logger, LoggingConfig, NoopLogger } from 'core-lib';
import { createMessageBus } from 'messaging-lib';
import { VehicleQueryHandler } from './handlers/VehicleQueryHandler.js';

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    return YAML.parse(file);
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
    
    const messageBus = createMessageBus(config.hub, logger);
    await messageBus.start();
    
    const vehicleQueryHandler = new VehicleQueryHandler(
        config,
        logger,
        messageBus, 
    );
    messageBus.registerHandlers(vehicleQueryHandler);

    await messageBus.watch(`query.vehicles`, 'vehicle-querier');
}

main().catch(console.error);
