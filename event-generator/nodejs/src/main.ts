import { Engine, VehiclePredicate } from "./engine.js";
import { KM, sleep, Rect, formatPoint, GpsCoordinates, MoveCommand, FlushCommand, Config, ConsoleLogger, addOffsetToCoordinates, Stopwatch, DataPartitionStrategyConfig, computeHashNumber, LoggingConfig, Logger, NoopLogger, GeneratorConfig } from 'core-lib';
import { createMessageBus } from 'messaging-lib';
import fs from 'fs';
import YAML from 'yaml';
import { IdDataPartitionStrategy } from "./data/IdDataPartitionStrategy.js";
import { GeohashDataPartitionStrategy } from "./data/GeohashDataPartitionStrategy.js";
import { IdGroupDataPartitionStrategy } from "./data/IdGroupDataPartitionStrategy.js";

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    return YAML.parse(file);
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

function getStartDate(config: GeneratorConfig): string {
    if (config.realtime) {
        return new Date().toISOString();
    }
    if (config.startDate) {
        return new Date(config.startDate).toISOString();
    }
    const offsetInMS = (config.maxNumberOfEvents / config.vehicleCount) * config.refreshIntervalInSecs * 1000;
    const now = new Date();
    return new Date(now.getTime() - offsetInMS).toISOString();
}


async function main() {
    const config = loadConfig('../../config.yaml');
    if (config.partitioning.dataPartition.type === 'collectorIndex') {
        if (config.collector.instances !== config.generator.instances) {
            throw new Error('When you use the collectorIndex data partitioning strategy, you must have the same number of generators and collectors');
        }
    }
    const generatorIndex = parseInt(process.env.GENERATOR_INDEX || '0');
    const logger =  createLogger(config.generator.logging, `Generator #${generatorIndex}`);
    const messageBus = createMessageBus(config.hub, logger);
    const vehicleCount = config.generator.vehicleCount;
    let maxNumberOfEvents = Math.trunc(config.generator.maxNumberOfEvents / config.generator.instances);
    if (generatorIndex === 0) {
        maxNumberOfEvents += config.generator.maxNumberOfEvents % config.generator.instances;
    }
    const refreshIntervalInSecs = config.generator.refreshIntervalInSecs;
    const realtime = config.generator.realtime;
    const terminateCollector = config.generator.terminateCollector;
    if (config.hub.type !== 'nats') {
        throw new Error('Expected nats config in hub');
    }
    await messageBus.start();

    if (generatorIndex === 0) {
        messageBus.publish(`stats`, { type: 'reset-aggregate-period-stats' });
    }
    
    const dataPartitionStrategy = createDataPartitionStrategy(config.partitioning.dataPartition);
    const startDate = getStartDate(config.generator);
    let vehiclePredicate: VehiclePredicate | undefined;
    if (config.generator.instances > 1) {
        vehiclePredicate = (idx, id) => idx % config.generator.instances === generatorIndex;
    }

    const engine = new Engine({
        vehicleCount,
        vehicleTypes: config.generator.vehicleTypes,
        regionBounds: new Rect(
            { 
                x: 0, 
                y: 0,
            },
            {
                width:  config.generator.map.widthInKm * KM,
                height: config.generator.map.heightInKm * KM,    
            }
        ),
        zoneSize: {
            width:  config.generator.zoneSize.widthInKm * KM,
            height: config.generator.zoneSize.heightInKm * KM,
        },
        speed: {
            min:  3 * KM,
            max: 40 * KM,
        },
        refreshIntervalInSecs,
        startDate,
        enableOscillation: true,
        vehiclePredicate,
    });

    const anchor: GpsCoordinates = config.generator.map.topLeftOrigin;
    const refreshIntervalInMS = refreshIntervalInSecs * 1000;
    let distributedRefreshIntervalInMS;
    let distributedRefreshFrequency;
    if (vehicleCount < refreshIntervalInMS) {
        distributedRefreshIntervalInMS = Math.trunc(refreshIntervalInMS / vehicleCount);
        distributedRefreshFrequency = 1;
    } else {
        distributedRefreshFrequency = Math.trunc(vehicleCount / refreshIntervalInMS);
        distributedRefreshIntervalInMS = Math.trunc(refreshIntervalInMS / distributedRefreshFrequency);
    }
    if (realtime) {
        logger.debug(`Realtime wait: ${distributedRefreshIntervalInMS} ms every ${distributedRefreshFrequency} vehicles`)
    }
    const watch = new Stopwatch();
    watch.start();
    let eventCount = 0;
    let done = false;
    while (!done) {
        let accumulatedWaitInMS = 0;
        const commands = engine.execute();
        let idx = 0;
        for (const cmd of commands) {
            logger.trace(cmd.timestamp, `Vehicle #${cmd.vehicle.id} ${cmd.newState.direction} ${formatPoint(cmd.vehicle.location)} speed=${cmd.newState.speed} localBounds=${cmd.newState.localBounds.toString()}, offset=${formatPoint(cmd.newState.offset)}`);
            const loc = cmd.vehicle.location;
            const gpsPos = addOffsetToCoordinates(anchor, loc.x, loc.y);
            const msg: MoveCommand = {
                type: 'move',
                vehicleId: cmd.vehicle.id,
                vehicleType: cmd.vehicle.type,
                zoneId: cmd.newState.zone.id,
                direction: cmd.newState.direction,
                speed: cmd.newState.speed,
                gps: gpsPos,
                timestamp: cmd.timestamp.toISOString(),
            }
            const dataPartitionKey = dataPartitionStrategy.getPartitionKey(msg);
            const collectorIndex = computeHashNumber(dataPartitionKey) % config.collector.instances;
            messageBus.publish(`commands.move.${collectorIndex}`, msg);
            eventCount++;
            idx++;
            if (eventCount >= maxNumberOfEvents) {
                done = true;
                break;
            }
            if (realtime) {
                if (idx % distributedRefreshFrequency === 0) {
                    await sleep(distributedRefreshIntervalInMS);
                    accumulatedWaitInMS += distributedRefreshIntervalInMS;
                }
            }
        }
        if (realtime) {
            const delta = refreshIntervalInMS - accumulatedWaitInMS;
            if (delta > 0) {
                await sleep(delta);
            }
        } else {
            await sleep(1);
        }
    }
    watch.stop();
    logger.info(`Done generating ${eventCount} out of ${config.generator.maxNumberOfEvents} events in ${watch.elapsedTimeAsString()}`);
    const flushCmd: FlushCommand = {
        type: 'flush',
        exitProcess: terminateCollector,
    }
    if (generatorIndex === 0) {
        await sleep(1000); // wait before flushing, in order to let the other generators complete their generation
        for (let i = 0; i < config.collector.instances; i++) {
            logger.info(`Flushing collector #${i}`);
            messageBus.publish(`commands.flush.${i}`, flushCmd);
        }    
    }
    await messageBus.stop();
}

main().catch(console.error);
