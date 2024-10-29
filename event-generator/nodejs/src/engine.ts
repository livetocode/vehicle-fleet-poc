import { Rect, Size, Range } from "core-lib";
import { Region, Vehicle, Zone, getRandomDirection, getRandomRangeValue, VehicleState, rotateClockwise, getRandomBounds } from "./types.js";
import { calcCount } from "./utils.js";

export interface MoveCommand {
    region: Region;
    vehicle: Vehicle;
    previousState: VehicleState;
    newState: VehicleState;
    timestamp: Date;
}

export type VehiclePredicate = (idx: number, id: string) => boolean;

export interface EngineOptions {
    vehicleCount: number;
    vehicleTypes: string[];
    regionBounds: Rect;
    zoneSize: Size;
    speed: Range;
    refreshIntervalInSecs: number;
    startDate: string;
    enableOscillation: boolean;
    vehiclePredicate?: VehiclePredicate;
}

export class Engine {
    private region: Region;
    private timestamp: Date;

    constructor(public readonly options: Readonly<EngineOptions>) {
        this.region = this.createRegion(options);
        this.timestamp = new Date(options.startDate);
    }

    execute(): MoveCommand[] {
        const result: MoveCommand[] = [];
        for (const vehicle of this.region.enumerateVehicles()) {
            const previousState = vehicle.state;
            const newState = this.calcNextState(previousState.zone, vehicle);
            vehicle.update(newState);
            result.push({
                region: this.region,
                vehicle,
                previousState,
                newState,
                timestamp: this.timestamp,
            });
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
                speed: getRandomRangeValue(this.options.speed), // change the speed every time we do a turn
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
                region.addZone(zone);
            }    
        }
        for (let i = 0; i < options.vehicleCount; i++) {
            const id = i.toString();
            const isValid = options.vehiclePredicate?.(i, id) ?? true;
            if (isValid) {
                const zone = region.zones[i % region.zones.length];
                const location = zone.bounds.getRandomPosition();
                const direction = getRandomDirection();
                const type = options.vehicleTypes[i % options.vehicleTypes.length];
                const vehicle = new Vehicle(id, type, {
                    zone,
                    location,
                    direction,
                    speed: getRandomRangeValue(options.speed),
                    offset: { x: 0, y: 0},
                    localBounds: getRandomBounds(location, zone.bounds, direction),
                });
                region.addVehicle(vehicle);
            }
        }
        return region;
    }
}


