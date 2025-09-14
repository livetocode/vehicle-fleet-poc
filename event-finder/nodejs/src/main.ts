import fs from 'fs';
import YAML from 'yaml';
import { Config, ConsoleLogger, Logger, NoopLogger, LoggingConfig, ServiceIdentity, services, requests, FinderConfig, IMessageBus } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import { VehicleQueryHandler } from './handlers/VehicleQueryHandler.js';
import { createDataFrameRepository, DataFrameRepository } from 'data-lib';
import { VehicleQueryPartitionHandler } from './handlers/VehicleQueryPartitionHandler.js';
import { VehicleQueryAzureSqlStrategy, VehicleQueryDataFrameRepositoryStrategy, VehicleQueryStrategy } from './handlers/VehicleQueryStrategy.js';

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

function createVehicleQueryStrategy(config: Config, logger: Logger, messageBus: IMessageBus, repo: DataFrameRepository): VehicleQueryStrategy {
    if (config.finder.dataSource.type === 'file') {
        return new VehicleQueryDataFrameRepositoryStrategy(config, logger, messageBus, repo);
    }
    if (config.finder.dataSource.type === 'azureSql') {
        return new VehicleQueryAzureSqlStrategy(config, logger, messageBus);
    }
    throw new Error('Unknown finder dataSource type');
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
        runtime: 'nodejs',
    }
    const logger =  createLogger(config.finder.logging, `${identity.name} #${finderIndex}`);
    
    const repo = createDataFrameRepository(config.collector.output);
    await repo.init();

    const messageBus = await createMessageBus(config.hub, identity, logger, config.chaosEngineering);

    const strategy = createVehicleQueryStrategy(config, logger, messageBus, repo);

    const vehicleQueryHandler = new VehicleQueryHandler(
        config,
        logger,
        messageBus,
        strategy,
    );

    const vehicleQueryPartitionHandler = new VehicleQueryPartitionHandler(
        config,
        logger,
        messageBus,
        repo,
    );
    messageBus.registerHandlers(vehicleQueryHandler, vehicleQueryPartitionHandler);

    if (config.finder.parallelSearch) {
        messageBus.subscribe({ type: 'queue', path: services.finders.any.subscribe({}) });
    }    
    messageBus.subscribe({ type: 'queue', path: requests.vehicles.query.subscribe({}) });

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.finder.httpPort, logger, identity);

    await messageBus.waitForClose();
    server.close();
}

main().catch(console.error);
