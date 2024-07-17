import { Engine } from "./engine.js";
import { KM, sleep, Rect, formatPoint, GpsCoordinates, MoveCommand, FlushCommand, Config, ConsoleLogger, addOffsetToCoordinates } from 'core-lib';
import { createMessageBus } from 'messaging-lib';
import fs from 'fs';
import YAML from 'yaml';

function loadConfig(filename: string): Config {
    const file = fs.readFileSync(filename, 'utf8')
    return YAML.parse(file);
}

async function main() {
    const config = loadConfig('../../config.yaml');
    const verbose = config.generator.verbose ;
    const logger = new ConsoleLogger(`Generator`);
    const messageBus = createMessageBus(config.hub, logger);
    const vehicleCount = config.generator.vehicleCount;
    const maxNumberOfEvents = config.generator.maxNumberOfEvents;
    const refreshIntervalInSecs = config.generator.refreshIntervalInSecs;
    const realtime = config.generator.realtime;
    const terminateCollector = config.generator.terminateCollector;
    if (config.hub.type !== 'nats') {
        throw new Error('Expected nats config in hub');
    }
    await messageBus.init();

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
    let eventCount = 0;
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
            messageBus.publish('commands', msg);
            eventCount++;
        }
        if (realtime) {
            // TODO: distribute the events in the refresh interval period instead of waiting for n secs and sending a big batch of events
            await sleep(refreshIntervalInSecs * 1000);
        } else {
            await sleep(10);
        }
    }
    const flushCmd: FlushCommand = {
        type: 'flush',
        exitProcess: terminateCollector,
    }
    logger.info(`Done generating ${eventCount} events.`);
    messageBus.publish('commands', flushCmd);
    await messageBus.drain();
}

main().catch(console.error);
