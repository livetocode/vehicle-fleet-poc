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
    // TODO: should I compute the number of iterations instead of the number of events?
    // This would allow me to not move vehicles that are not published,
    // but it would be hard to generate the exact number of events when we have multiple generators.
    const maxNumberOfEvents = config.generator.maxNumberOfEvents;
    // let maxNumberOfEvents = Math.trunc(config.generator.maxNumberOfEvents / config.generator.generatorCount);
    // if (generatorIndex === 0) {
    //     maxNumberOfEvents += config.generator.maxNumberOfEvents % config.generator.generatorCount;
    // }
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
        // TODO: should I remove onAcceptsVehicle?
        onAcceptsVehicle: (id) => true, //computeHashNumber(id) % config.generator.generatorCount === generatorIndex,
    });

    const anchor: GpsCoordinates = {
        // https://www.google.ca/maps/@45.6656598,-74.0651269,11.76z?entry=ttu
        lat: 45.6656598, 
        lon: -74.0651269,
        alt: 11.76,
    };
    const watch = new Stopwatch();
    watch.start();
    let eventCount = 0;
    let publishedEvents = 0;
    while (eventCount < maxNumberOfEvents) {
        const commands = engine.execute();
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
        }
        if (realtime) {
            // TODO: distribute the events in the refresh interval period instead of waiting for n secs and sending a big batch of events
            await sleep(refreshIntervalInSecs * 1000);
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
