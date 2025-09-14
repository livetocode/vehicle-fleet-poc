import fs from 'fs';
import YAML from 'yaml';
import { MoveCommandHandler } from "./handlers/MoveCommandHandler.js";
import { FileAggregateStore } from "./core/persistence/FileAggregateStore.js";
// import { DuckDbEventStore } from "./core/persistence/DuckDbEventStore.js";
import { NoOpEventStore } from "./core/persistence/NoOpEventStore.js";
import { CollectorConfig, Config, EventStoreConfig, ConsoleLogger, Logger, DataPartitionStrategyConfig, LoggingConfig, NoopLogger, ServiceIdentity, MessageTrackingCollection, commands, requests, services, IMessageBus, EventDispatcherConfig, ConcreteEventDispatcherConfig } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import { InMemoryEventStore } from './core/persistence/InMemoryEventStore.js';
import { AggregateStore } from './core/persistence/AggregateStore.js';
import { NoOpAggregateStore } from './core/persistence/NoOpAggregateStore.js';
import { IdDataPartitionStrategy } from './core/data/IdDataPartitionStrategy.js';
import { GeohashDataPartitionStrategy } from './core/data/GeohashDataPartitionStrategy.js';
import { IdGroupDataPartitionStrategy } from './core/data/IdGroupDataPartitionStrategy.js';
import { createDataFrameRepository, DataFrameFormat, DataFrameRepository, stringToFormat } from 'data-lib';
import { ClearVehiclesDataHandler } from './handlers/ClearVehiclesDataHandler.js';
import { MoveCommandAccumulator, PersistedMoveCommand } from './handlers/MoveCommandAccumulator.js';
import { FlushDataHandler, FlushRequestHandler } from './handlers/FlushDataHandler.js';
import { AssignedMoveCommandHandler } from './handlers/AssignedMoveCommandHandler.js';
import { PrepareCollectorHandler } from './handlers/PrepareCollectorHandler.js';
import { DispatchFlushDataHandler, DispatchFlushRequestHandler } from './handlers/DispatchFlushDataHandler.js';
import { AzureEventHubMoveEventDispatcher, MessageBusMoveEventDispatcher, MoveEventDispatcher, MoveEventDispatcherProxy } from './core/persistence/EventDispatchers.js';

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

function createConcreteMoveEventDispatcher(config: ConcreteEventDispatcherConfig, messageBus: IMessageBus, logger: Logger): MoveEventDispatcher {
    if (config.type === 'messageBus') {
        return new MessageBusMoveEventDispatcher(messageBus);        
    }
    if (config.type === 'azureEventHub') {
        return new AzureEventHubMoveEventDispatcher(logger, config);
    }
    throw new Error(`Unknown concrete event dispatcher config type '${(config as any).type}'`);
}

function createMoveEventDispatcher(config: CollectorConfig, messageBus: IMessageBus, logger: Logger): MoveEventDispatcher {
    if (config.eventDispatcher.type === 'proxy') {
        const dispatchers = config.eventDispatcher.dispatchers.map(x => createConcreteMoveEventDispatcher(x, messageBus, logger));
        if (dispatchers.length === 1) {
            return dispatchers[0];
        }
        return new MoveEventDispatcherProxy(dispatchers);
    }
    return createConcreteMoveEventDispatcher(config.eventDispatcher, messageBus, logger);
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
    const identity: ServiceIdentity = {
        name: 'collector',
        instance: collectorIndex,
        runtime: 'nodejs',
    }
    const logger =  createLogger(config.collector.logging, `${identity.name} #${collectorIndex}`);
        
    const eventStore = createEventStore(config.collector.eventStore);
    await eventStore.init();

    const repo = createDataFrameRepository(config.collector.output);
    await repo.init();

    const aggregateStore = createAggregateStore(config.collector, logger, repo);
    const dataPartitionStrategy = createDataPartitionStrategy(config.partitioning.dataPartition, collectorIndex);

    const messageBus = await createMessageBus(config.hub, identity, logger, config.chaosEngineering);
    
    const accumulator = new MoveCommandAccumulator(
        config,
        logger,
        messageBus,
        eventStore,
        aggregateStore,
        collectorIndex,
    );

    const moveEventDispatcher = createMoveEventDispatcher(config.collector, messageBus, logger);

    const trackingCollection = new MessageTrackingCollection();

    const moveCommandHandler = new MoveCommandHandler(
        config,
        dataPartitionStrategy,
        moveEventDispatcher,
    );

    const assignedMoveCommandHandler = new AssignedMoveCommandHandler(
        logger,
        config.backpressure,
        messageBus,
        eventStore, 
        accumulator,
        collectorIndex,
        trackingCollection,
    );
    await assignedMoveCommandHandler.init();
    
    const prepareHandler = new PrepareCollectorHandler(logger, trackingCollection, accumulator);
    const flushDataHandler = new FlushDataHandler(logger, accumulator);
    const flushRequestHandler = new FlushRequestHandler(logger, accumulator);
    const dispatchFlushDataHandler = new DispatchFlushDataHandler(logger, messageBus, config);
    const dispatchFlushRequestHandler = new DispatchFlushRequestHandler(logger, messageBus, config);
    const clearVehiclesDataHandler = new ClearVehiclesDataHandler(logger, repo);

    messageBus.registerHandlers(
        moveCommandHandler, 
        assignedMoveCommandHandler, 
        prepareHandler, 
        flushDataHandler, 
        flushRequestHandler, 
        dispatchFlushDataHandler,
        dispatchFlushRequestHandler,
        clearVehiclesDataHandler,
    );

    messageBus.subscribe({ type: 'queue', path: commands.move.subscribe({}) });
    messageBus.subscribe({ type: 'queue', path: requests.vehicles.clear.subscribe({}) });
    messageBus.subscribe({ type: 'queue', path: services.collectors.assigned.subscribe({ index: collectorIndex.toString() }) });

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.collector.httpPort, logger, identity);

    await messageBus.waitForClose();
    server.close();
}

main().catch(console.error);
