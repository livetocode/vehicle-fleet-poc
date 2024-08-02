import { Rect, Size, Range } from "core-lib";
import { Region, Vehicle, Zone, getRandomDirection, getRandomRangeValue, VehicleState, rotateClockwise, getRandomBounds } from "./types.js";
import { calcCount } from "./utils.js";

export interface MoveCommand {
    region: Region;
    zone: Zone;
    vehicle: Vehicle;
    previousState: VehicleState;
    newState: VehicleState;
    timestamp: Date;
}

export interface EngineOptions {
    vehicleCount: number;
    regionBounds: Rect;
    zoneSize: Size;
    speed: Range;
    refreshIntervalInSecs: number;
    timeOffsetInMS: number;
    enableOscillation: boolean;
    onAcceptsVehicle: (id: string) => boolean;
}

export class Engine {
    private region: Region;
    private timestamp: Date;

    constructor(public readonly options: Readonly<EngineOptions>) {
        this.region = this.createRegion(options);
        this.timestamp = new Date();
        this.timestamp = new Date(this.timestamp.getTime() - options.timeOffsetInMS);
    }

    execute(): MoveCommand[] {
        const result: MoveCommand[] = [];
        for (const zone of this.region.enumerateZones()) {
            for (const vehicle of zone.enumerateVehicles()) {
                const previousState = vehicle.state;
                const newState = this.calcNextState(zone, vehicle);
                vehicle.update(newState);
                result.push({
                    region: this.region,
                    zone,
                    vehicle,
                    previousState,
                    newState,
                    timestamp: this.timestamp,
                });
            }
        }
        this.timestamp = new Date(this.timestamp.getTime() + this.options.refreshIntervalInSecs * 1000);
        return result;
    }

    private calcNextState(zone: Zone, vehicle: Vehicle): Readonly<VehicleState> {
        let nextState = vehicle.move(this.options.refreshIntervalInSecs, this.options.enableOscillation);
        if (!nextState.localBounds.containsPoint(nextState.location)) {
            const direction = rotateClockwise(vehicle.state.direction);
            nextState = {
                ...vehicle.state,
                direction,
                localBounds: getRandomBounds(vehicle.state.location, zone.bounds, direction),
            }
        }
        return nextState;
    }

    private createRegion(options: EngineOptions): Region {
        const region = new Region(options.regionBounds);
        const horizCount = calcCount(options.regionBounds.size.width, options.zoneSize.width);
        const vertCount = calcCount(options.regionBounds.size.height, options.zoneSize.height);
        const vehiclesPerZone = calcCount(options.vehicleCount, horizCount * vertCount);
        let zoneIdx = 0;
        let vehicleIdx = 0;
        for (let horizIndex = 0; horizIndex < horizCount; horizIndex++) {
            for (let vertIndex = 0; vertIndex < vertCount; vertIndex++) {
                const bounds = options.regionBounds.intersect(
                    new Rect(
                        { 
                            x: options.regionBounds.minX + horizIndex * options.zoneSize.width, 
                            y: options.regionBounds.minY + vertIndex * options.zoneSize.height 
                        },
                        options.zoneSize,
                    )
                );
                zoneIdx++;
                const zone = new Zone(zoneIdx.toString(), bounds);
                for (let i = 0; i < vehiclesPerZone; i++) {
                    if (vehicleIdx < options.vehicleCount) {
                        vehicleIdx++;
                        const id = vehicleIdx.toString();
                        if (options.onAcceptsVehicle(id)) {
                            const location = zone.bounds.getRandomPosition();
                            const direction = getRandomDirection();
                            const vehicle = new Vehicle(id, {
                                location,
                                direction,
                                speed: getRandomRangeValue(options.speed),
                                offset: { x: 0, y: 0},
                                localBounds: getRandomBounds(location, zone.bounds, direction),
                            });
                            zone.add(vehicle);        
                        }
                    }
                }
                region.add(zone);
            }    
        }
        return region;
    }
}


