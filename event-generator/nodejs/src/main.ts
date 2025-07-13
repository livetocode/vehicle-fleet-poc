import { Config, ConsoleLogger, LoggingConfig, Logger, NoopLogger, ServiceIdentity, MessageTrackingCollection, services, requests } from 'core-lib';
import { createMessageBus, createWebServer } from 'messaging-lib';
import fs from 'fs';
import YAML from 'yaml';
import { GenerateHandler } from "./handlers/GenerateHandler.js";
import { GeneratePartitionHandler } from './handlers/GeneratePartitionHandler.js';
import { MessageTrackingHandler } from './handlers/MessageTrackingHandler.js';

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
    if (config.partitioning.dataPartition.type === 'collectorIndex') {
        if (config.collector.instances !== config.generator.instances) {
            throw new Error('When you use the collectorIndex data partitioning strategy, you must have the same number of generators and collectors');
        }
    }
    const generatorIndex = getInstanceIndex();
    const identity: ServiceIdentity = {
        name: 'generator',
        instance: generatorIndex,
    }
    const logger =  createLogger(config.generator.logging, `${identity.name} #${generatorIndex}`);
    const messageBus = await createMessageBus(config.hub, identity, logger, config.chaosEngineering);

    const messageTrackingCollection = new MessageTrackingCollection();
    
    const startGenerationHandler = new GenerateHandler(
        config,
        logger,
        messageBus,
    );
    const generatePartitionHandler = new GeneratePartitionHandler(
        config,
        logger,
        messageBus,
        generatorIndex,
        messageTrackingCollection,
    );
    const messageTrackingHandler = new MessageTrackingHandler(
        messageTrackingCollection,
    );

    messageBus.registerHandlers(startGenerationHandler, generatePartitionHandler, messageTrackingHandler);

    
    messageBus.subscribe({ type: 'queue', path: services.generators.assigned.subscribe({ index: generatorIndex.toString() }) });
    if (config.backpressure.enabled) {
        messageBus.subscribe({ type: 'queue', path: services.generators.tracking.subscribe({ index: generatorIndex.toString() }) });
    }
    messageBus.subscribe({ type: 'queue', path: requests.vehicles.generate.subscribe({})});

    const httpPortOverride = process.env.NODE_HTTP_PORT ? parseInt(process.env.NODE_HTTP_PORT) : undefined;
    const server = createWebServer(httpPortOverride ?? config.generator.httpPort, logger, identity);
    
    await messageBus.waitForClose();
    server.close();
}

main().catch(console.error);
