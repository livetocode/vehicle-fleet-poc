import { Engine } from "./engine.js";
import { KM, sleep, Rect, formatPoint, GpsCoordinates, MoveCommand, FlushCommand, Config, ConsoleLogger, addOffsetToCoordinates, Stopwatch, DataPartitionStrategyConfig, computeHashNumber } from 'core-lib';
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

async function main() {
    const config = loadConfig('../../config.yaml');
    const verbose = config.generator.verbose ;
    const generatorIndex = parseInt(process.env.GENERATOR_INDEX || '0');
    const logger = new ConsoleLogger(`Generator #${generatorIndex}`);
    const messageBus = createMessageBus(config.hub, logger);
    const vehicleCount = config.generator.vehicleCount;
    let maxNumberOfEvents = Math.trunc(config.generator.maxNumberOfEvents / config.generator.generatorCount);
    if (generatorIndex === 0) {
        maxNumberOfEvents += config.generator.maxNumberOfEvents % config.generator.generatorCount;
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
    
    const dataPartitionStrategy = createDataPartitionStrategy(config.generator.dataPartition);
    const timeOffsetInMS = realtime ? 0 : (maxNumberOfEvents / vehicleCount) * refreshIntervalInSecs * 1000;
    const engine = new Engine({
        vehicleCount,
        regionBounds: new Rect(
            { 
                x: 0, 
                y: 0,
            },
            {
                width:  40 * KM,
                height: 20 * KM,    
            }
        ),
        zoneSize: {
            width:  10 * KM,
            height: 10 * KM,
        },
        speed: {
            min:  3 * KM,
            max: 40 * KM,
        },
        refreshIntervalInSecs,
        timeOffsetInMS,
        enableOscillation: true,
    });

    const anchor: GpsCoordinates = {
        // https://www.google.ca/maps/@45.6656598,-74.0651269,11.76z?entry=ttu
        lat: 45.6656598, 
        lon: -74.0651269,
        alt: 11.76,
    };
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
    let publishedEvents = 0;
    let done = false;
    while (!done) {
        let accumulatedWaitInMS = 0;
        const commands = engine.execute();
        let idx = 0;
        for (const cmd of commands) {
            if (verbose) {
                logger.debug(cmd.timestamp, `Vehicle #${cmd.vehicle.id} ${cmd.newState.direction} ${formatPoint(cmd.vehicle.location)} speed=${cmd.newState.speed} localBounds=${cmd.newState.localBounds.toString()}, offset=${formatPoint(cmd.newState.offset)}`);
            }
            const loc = cmd.vehicle.location;
            const gpsPos = addOffsetToCoordinates(anchor, loc.x, loc.y);
            const msg: MoveCommand = {
                type: 'move',
                vehicleId: cmd.vehicle.id,
                zone: {
                    id: cmd.zone.id,
                    bounds: cmd.zone.bounds,
                },
                regionBounds: cmd.region.bounds,
                location: loc,
                direction: cmd.newState.direction,
                speed: cmd.newState.speed,
                gps: gpsPos,
                timestamp: cmd.timestamp.toISOString(),
            }
            const dataPartitionKey = dataPartitionStrategy.getPartitionKey(msg);
            const collectorIndex = computeHashNumber(dataPartitionKey) % config.collector.collectorCount;
            if (config.generator.generatorCount === 1 || collectorIndex === generatorIndex) {
                messageBus.publish(`commands.move.${collectorIndex}`, msg);
                publishedEvents += 1;
            }
            eventCount++;
            idx++;
            if (publishedEvents >= maxNumberOfEvents) {
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
                console.log('delta', delta)
                await sleep(delta);
            }
        } else {
            await sleep(1);
        }
    }
    watch.stop();
    logger.info(`Done generating ${publishedEvents} out of ${eventCount} events in ${watch.elapsedTimeAsString()}`);
    const flushCmd: FlushCommand = {
        type: 'flush',
        exitProcess: terminateCollector,
    }
    if (config.generator.generatorCount === 1) {
        for (let i = 0; i < config.collector.collectorCount; i++) {
            messageBus.publish(`commands.flush.${i}`, flushCmd);
        }    
    } else {
        messageBus.publish(`commands.flush.${generatorIndex}`, flushCmd);
    }
    await messageBus.stop();
}

main().catch(console.error);
