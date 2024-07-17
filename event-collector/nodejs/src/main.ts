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
import { CollectorConfig, Config, EventStoreConfig, ConsoleLogger, Logger } from 'core-lib';
import { createMessageBus } from 'messaging-lib';
import { InMemoryEventStore } from './core/persistence/InMemoryEventStore.js';
import { FileWriter } from './core/persistence/formats/FileWriter.js';
import { AggregateStore } from './core/persistence/AggregateStore.js';

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

async function createAndInitializeAggregator(config: CollectorConfig, logger: Logger): Promise<AggregateStore<PersistedMoveCommand>> {
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
    for (const format of formats) {
        await format.init();
    }
    let aggregateStore: AggregateStore<PersistedMoveCommand>;
    if (config.output.type === 'file') {
        aggregateStore = new FileAggregateStore<PersistedMoveCommand>(logger, config.output.folder, formats);    
     } else {
        throw new Error(`Unknown output type '${(config.output as any).type}'`);
     }
    await aggregateStore.init();
    return aggregateStore;
}

async function main() {
    const config = loadConfig('../../config.yaml');    
    const collectorIndex = parseInt(process.env.COLLECTOR_INDEX || '0');
    const logger = new ConsoleLogger(`Collector #${collectorIndex}`);
    
    const messageBus = createMessageBus(config.hub, logger);
    await messageBus.init();
    const eventStore = createEventStore(config.collector.eventStore);
    await eventStore.init();

    const aggregateStore = await createAndInitializeAggregator(config.collector, logger);
    
    const moveCommandHandler = new MoveCommandHandler(
        config.collector,
        logger,
        messageBus, 
        eventStore, 
        aggregateStore, 
        collectorIndex, 
    );
    messageBus.registerHandlers(moveCommandHandler);

    await messageBus.run('commands');
}

main().catch(console.error);