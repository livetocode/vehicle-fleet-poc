import fs from 'fs';
import YAML from 'yaml';
import { MoveCommandHandler, PersistedMoveCommand } from "./handlers/MoveCommandHandler.js";
import { FileAggregateStore } from "./core/persistence/FileAggregateStore.js";
// import { DuckDbEventStore } from "./core/persistence/DuckDbEventStore.js";
import { NoOpEventStore } from "./core/persistence/NoOpEventStore.js";
import { CollectorConfig, Config, EventStoreConfig, ConsoleLogger, Logger, DataPartitionStrategyConfig, LoggingConfig, NoopLogger } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import { InMemoryEventStore } from './core/persistence/InMemoryEventStore.js';
import { AggregateStore } from './core/persistence/AggregateStore.js';
import { NoOpAggregateStore } from './core/persistence/NoOpAggregateStore.js';
import { IdDataPartitionStrategy } from './core/data/IdDataPartitionStrategy.js';
import { GeohashDataPartitionStrategy } from './core/data/GeohashDataPartitionStrategy.js';
import { IdGroupDataPartitionStrategy } from './core/data/IdGroupDataPartitionStrategy.js';
import { createDataFrameRepository, DataFrameFormat, DataFrameRepository, stringToFormat } from 'data-lib';
import { ClearVehiclesDataHandler } from './handlers/ClearVehiclesDataHandler.js';

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    const result: Config = YAML.parse(file);
    const instances = process.env.COLLECTOR_INSTANCES;
    if (instances && parseInt(instances) > 0) {
        result.collector.instances = parseInt(instances);
    }
    return result;
}

function createEventStore(config: EventStoreConfig) {
    switch(config.type) {
        case 'noop':
            return  new NoOpEventStore<PersistedMoveCommand>();
        case'memory':
            return  new InMemoryEventStore<PersistedMoveCommand>();  
        // Disabled because it causes an error when running in Docker with ARM CPU
        // case 'duckdb':
        //     return new DuckDbEventStore<PersistedMoveCommand>();
        default:
            throw new Error(`Unknown event store type '${(config as any).type}'`);
    }
}

function createAggregateStore(config: CollectorConfig, logger: Logger, repo: DataFrameRepository): AggregateStore<PersistedMoveCommand> {
    if (config.output.storage.type === 'noop') {
        return new NoOpAggregateStore();
    }
    let formats: DataFrameFormat[] = config.output.formats.map(stringToFormat);
    const aggregateStore = new FileAggregateStore<PersistedMoveCommand>(
        logger, 
        config.output.overwriteExistingFiles, 
        config.output.flatLayout, 
        formats, 
        repo);
    return aggregateStore;
}

function createDataPartitionStrategy(config: DataPartitionStrategyConfig, collectorIndex: number) {
    if (config.type === 'id') {
        return new IdDataPartitionStrategy();
    }
    if (config.type === 'idGroup') {
        return new IdGroupDataPartitionStrategy(config.groupSize);
    }
    if (config.type === 'geohash') {
        return new GeohashDataPartitionStrategy(config.hashLength);
    }
    throw new Error('Unknown data partition strategy');
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
    const collectorIndex = getInstanceIndex();
    const logger =  createLogger(config.collector.logging, `Collector #${collectorIndex}`);
    
    const messageBus = createMessageBus(config.hub, 'collector', logger);
    await messageBus.start();
    const eventStore = createEventStore(config.collector.eventStore);
    await eventStore.init();

    const repo = createDataFrameRepository(config.collector.output);
    await repo.init();

    const aggregateStore = createAggregateStore(config.collector, logger, repo);
    const dataPartitionStrategy = createDataPartitionStrategy(config.partitioning.dataPartition, collectorIndex);

    
    const moveCommandHandler = new MoveCommandHandler(
        config,
        logger,
        messageBus, 
        eventStore, 
        aggregateStore,
        dataPartitionStrategy,
        collectorIndex, 
    );
    await moveCommandHandler.init();

    const clearVehiclesDataHandler = new ClearVehiclesDataHandler(logger, messageBus, repo);

    messageBus.registerHandlers(moveCommandHandler, clearVehiclesDataHandler);

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.collector.httpPort, logger, 'collector');
    messageBus.watch(`requests.collector`, `requests-collector`).catch(console.error);
    await messageBus.watch(`commands.*.${collectorIndex}`);
    server.close();
}

main().catch(console.error);
