import fs from 'fs';
import YAML from 'yaml';
import { Config, ConsoleLogger, Logger, NoopLogger, LoggingConfig, ServiceIdentity } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import { VehicleQueryHandler } from './handlers/VehicleQueryHandler.js';
import { createDataFrameRepository } from 'data-lib';

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

function getInstanceIndex(): number {
    const instance_index = process.env.INSTANCE_INDEX;
    if (typeof instance_index === 'string' && instance_index !== '') {
        return parseInt(instance_index);

    }
    const hostname = process.env.HOSTNAME;
    if (hostname) {
        const idx = hostname.lastIndexOf('-');
        if (idx > 0) {
            const suffix = hostname.substring(idx + 1);
            if (suffix.length > 0) {
                const val = parseInt(suffix);
                if (!Number.isNaN(val)) {
                    return val;
                }
            }
        }
    }
    return 0;
}

async function main() {
    const config = loadConfig('../../config.yaml');    
    const finderIndex = getInstanceIndex();
    const identity: ServiceIdentity = {
        name: 'finder',
        instance: finderIndex,
    }
    const logger =  createLogger(config.finder.logging, `${identity.name} #${finderIndex}`);
    
    const repo = createDataFrameRepository(config.collector.output);
    await repo.init();

    const messageBus = await createMessageBus(config.hub, identity, logger);

    const vehicleQueryHandler = new VehicleQueryHandler(
        config,
        logger,
        messageBus,
        repo,
    );
    messageBus.registerHandlers(vehicleQueryHandler);

    if (config.finder.parallelSearch) {
        messageBus.subscribe(`query.vehicles.partitions`, 'vehicle-finder-partitions');
    }    
    messageBus.subscribe(`query.vehicles`, 'vehicle-finder');

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.finder.httpPort, logger, identity);

    await messageBus.waitForClose();
    server.close();
}

main().catch(console.error);
