import { Config, ConsoleLogger, DataPartitionStrategyConfig, LoggingConfig, Logger, NoopLogger } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import fs from 'fs';
import YAML from 'yaml';
import { IdDataPartitionStrategy } from "./data/IdDataPartitionStrategy.js";
import { GeohashDataPartitionStrategy } from "./data/GeohashDataPartitionStrategy.js";
import { IdGroupDataPartitionStrategy } from "./data/IdGroupDataPartitionStrategy.js";
import { StartGenerationHandler } from "./handlers/StartGenerationHandler.js";

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    const result: Config = YAML.parse(file);
    const generatorInstances = process.env.GENERATOR_INSTANCES;
    if (generatorInstances && parseInt(generatorInstances) > 0) {
        result.generator.instances = parseInt(generatorInstances);
    }
    const collectorInstances = process.env.COLLECTOR_INSTANCES;
    if (collectorInstances && parseInt(collectorInstances) > 0) {
        result.collector.instances = parseInt(collectorInstances);
    }
    return result;
}

function createDataPartitionStrategy(config: DataPartitionStrategyConfig) {
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
    if (config.partitioning.dataPartition.type === 'collectorIndex') {
        if (config.collector.instances !== config.generator.instances) {
            throw new Error('When you use the collectorIndex data partitioning strategy, you must have the same number of generators and collectors');
        }
    }
    const generatorIndex = parseInt(process.env.INSTANCE_INDEX || '0');
    const logger =  createLogger(config.generator.logging, `Generator #${generatorIndex}`);
    const messageBus = createMessageBus(config.hub, 'generator', logger);
    await messageBus.start();

    const dataPartitionStrategy = createDataPartitionStrategy(config.partitioning.dataPartition);
    const startGenerationHandler = new StartGenerationHandler(
        config,
        logger,
        messageBus,
        generatorIndex,
        dataPartitionStrategy,
    );

    messageBus.registerHandlers(startGenerationHandler);

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.generator.httpPort, logger, 'generator');
    messageBus.watch(messageBus.privateInboxName).catch(console.error);
    messageBus.watch(`generation.agent.${generatorIndex}`, 'generation-agents').catch(console.error);
    await messageBus.watch(`generation`, 'generators');
    server.close();
}

main().catch(console.error);
