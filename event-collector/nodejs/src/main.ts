import fs from 'fs';
import YAML from 'yaml';
import { MoveCommandHandler, PersistedMoveCommand } from "./handlers/MoveCommandHandler.js";
import { FileAggregateStore } from "./core/persistence/FileAggregateStore.js";
import { DuckDbEventStore } from "./core/persistence/DuckDbEventStore.js";
import { ParquetFileWriter } from "./core/persistence/formats/ParquetFileWriter.js";
import { JsonFileWriter } from "./core/persistence/formats/JsonFileWriter.js";
import { CsvFileWriter } from "./core/persistence/formats/CsvFileWriter.js";
import { ArrowFileWriter } from "./core/persistence/formats/ArrowFileWriter.js";
import { NoOpEventStore } from "./core/persistence/NoOpEventStore.js";
import { CollectorConfig, Config, EventStoreConfig, ConsoleLogger, Logger, DataPartitionStrategyConfig, LoggingConfig, NoopLogger } from 'core-lib';
import { createMessageBus } from 'messaging-lib';
import { InMemoryEventStore } from './core/persistence/InMemoryEventStore.js';
import { FileWriter } from './core/persistence/formats/FileWriter.js';
import { AggregateStore } from './core/persistence/AggregateStore.js';
import { NoOpAggregateStore } from './core/persistence/NoOpAggregateStore.js';
import { IdDataPartitionStrategy } from './core/data/IdDataPartitionStrategy.js';
import { GeohashDataPartitionStrategy } from './core/data/GeohashDataPartitionStrategy.js';
import { IdGroupDataPartitionStrategy } from './core/data/IdGroupDataPartitionStrategy.js';

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    return YAML.parse(file);
}

function createEventStore(config: EventStoreConfig) {
    switch(config.type) {
        case 'noop':
            return  new NoOpEventStore<PersistedMoveCommand>();
        case'memory':
            return  new InMemoryEventStore<PersistedMoveCommand>();  
        case 'duckdb':
            return new DuckDbEventStore<PersistedMoveCommand>();
        default:
            throw new Error(`Unknown event store type '${(config as any).type}'`);
    }
}

function createAggregateStore(config: CollectorConfig, logger: Logger): AggregateStore<PersistedMoveCommand> {
    if (config.output.type === 'noop') {
        return new NoOpAggregateStore();
    }
    const formats: FileWriter[] = [];
    if (config.output.type === 'file' && config.output.formats) {
        if (config.output.formats.includes('json')) {
            formats.push(new JsonFileWriter(false));
        }
        if (config.output.formats.includes('csv')) {
            formats.push(new CsvFileWriter());
        }
        if (config.output.formats.includes('parquet')) {
            formats.push(new ParquetFileWriter());
        }
        if (config.output.formats.includes('arrow')) {
            formats.push(new ArrowFileWriter());
        }
    } else {
        throw new Error(`Unknown output type '${config.output.type}'`);
    }
    let aggregateStore: AggregateStore<PersistedMoveCommand>;
    if (config.output.type === 'file') {
        aggregateStore = new FileAggregateStore<PersistedMoveCommand>(logger, config.output.folder, config.output.flatLayout, formats);
     } else {
        throw new Error(`Unknown output type '${(config.output as any).type}'`);
     }
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

async function main() {
    const config = loadConfig('../../config.yaml');    
    const collectorIndex = parseInt(process.env.COLLECTOR_INDEX || '0');
    const logger =  createLogger(config.collector.logging, `Collector #${collectorIndex}`);
    logger.debug('test');
    
    const messageBus = createMessageBus(config.hub, logger);
    await messageBus.start();
    const eventStore = createEventStore(config.collector.eventStore);
    await eventStore.init();

    const aggregateStore = createAggregateStore(config.collector, logger);
    await aggregateStore.init();
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
    messageBus.registerHandlers(moveCommandHandler);

    await messageBus.watch(`commands.*.${collectorIndex}`);
}

main().catch(console.error);
