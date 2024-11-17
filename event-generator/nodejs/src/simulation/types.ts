import { Point, Rect, Size, Range } from 'core-lib';

export type Direction = 'north' | 'south' | 'east' | 'west';

export interface VehicleState {
    location: Point;
    speed: number;
    direction: Direction;
    offset: Point;
    localBounds: Rect;
    zone: Zone;
}

export class Vehicle {
    private _state: Readonly<VehicleState>;

    constructor(
        public readonly id: string, 
        public readonly type: string, 
        initialState: Readonly<VehicleState>,
    ) {
        this._state = initialState;
    }

    get location(): Point {
        return {
            x: Math.min(this._state.localBounds.maxX, Math.max(this._state.localBounds.minX, this._state.location.x + this._state.offset.x)),
            y: Math.min(this._state.localBounds.maxY, Math.max(this._state.localBounds.minY, this._state.location.y + this._state.offset.y)),
        }
    }

    get state(): Readonly<VehicleState> {
        return this._state;
    }

    move(refreshIntervalInSecs: number, enableOscillation: boolean): Readonly<VehicleState> {
        const speed = calcSpeedIncrement(this._state.speed, refreshIntervalInSecs);
        let { x, y } = this._state.location;
        let offset: Point = { x: 0, y: 0 };
        switch(this._state.direction) {
            case 'north':
                y += speed;
                break;
            case 'south':
                y -= speed;
                break;
            case 'east':
                x += speed;
                break;
            case 'west':
                x -= speed;
                break;
            default:
                throw new Error(`Unexpected direction ${this._state.direction}`);
        }
        if (enableOscillation) {
            const amplitude = 10;
            const frequency = 100;
    
            switch(this._state.direction) {
                case 'north':
                case 'south':
                    offset.x = amplitude * Math.sin(y / frequency);
                    break;
                case 'east':
                case 'west':
                    offset.y = amplitude * Math.sin(x / frequency);
                    break;
                default:
                    throw new Error(`Unexpected direction ${this._state.direction}`);
            }
                        
        }

        return {
            ...this._state,
            location: { x, y },
            offset,
        }
    }

    update(state: Readonly<VehicleState>) {
        this._state = state;
    }
}

export class Zone {
    constructor(public readonly id: string, public readonly bounds: Rect) {}
}

export class Region {
    private _vehicles: Vehicle[] = [];
    private _zones: Zone[] = [];

    constructor(public readonly bounds: Rect) { }

    get zones() {
        return this._zones;
    }

    addZone(zone: Zone) {
        if (!this.bounds.containsBounds(zone.bounds)) {
            console.log(this.bounds, zone.bounds);
            throw new Error(`one bounds must be completely included in the region's bounds`);
        }
        this._zones.push(zone);
    }

    addVehicle(vehicle: Vehicle) {
        this._vehicles.push(vehicle);
    }

    *enumerateZones() {
        for (const z of this._zones) {
            yield z;
        }
    }

    *enumerateVehicles() {
        for (const v of this._vehicles) {
            yield v;
        }
    }
}

export class ViewPort {
    constructor(public readonly innerBounds: Rect, public readonly outerBound: Rect) {}
    
    translatePoint(location: Point): Point {
        return {
            x: this.innerBounds.minX + this.innerBounds.width * (location.x / this.outerBound.maxX),
            y: this.innerBounds.minY + this.innerBounds.height * (location.y / this.outerBound.maxY),
        };
    }

    translateSize(size: Size): Size {
        return {
            width: this.innerBounds.width * (size.width / this.outerBound.width),
            height: this.innerBounds.height * (size.height / this.outerBound.height),
        };
    }
}

export function rotateClockwise(dir: Direction): Direction {
    switch(dir) {
        case 'north':
            return 'east';
        case 'east':
            return 'south';
        case 'south':
            return 'west';
        default:
            return 'north'
    }
}

export function getRandomDirection(): Direction {
    const val = 100 * Math.random();
    if (val < 25) {
        return 'north';
    }
    if (val < 50) {
        return 'east';
    }
    if (val < 75) {
        return 'west';
    }
    return 'south';
}

export function getRandomRangeValue(range: Range): number {
    return Math.trunc(range.min + (range.max - range.min - 1) * Math.random());
}

export function getRandomBounds(location: Point, bounds: Rect, direction: Direction): Rect {
    switch(direction) {
        case 'north': {
            const dY = bounds.maxY - location.y;
            const newHeight = (location.y - bounds.minY) + dY * Math.random();
            return new Rect(bounds.origin, { width: bounds.width, height: newHeight });
        }
        case 'east': {
            const dX = bounds.maxX - location.x;
            const newWidth = (location.x - bounds.minX) + dX * Math.random();
            return new Rect(bounds.origin, { width: newWidth, height: bounds.height });
        }
        case 'south': {
            const dY = location.y - bounds.minY;
            const newY = location.y - dY * Math.random();
            return new Rect(
                { x: bounds.minX, y: newY },
                { width: bounds.width, height: bounds.maxY - newY});
        }
        default: {
            const dX = location.x - bounds.minX;
            const newX = location.x - dX * Math.random();
            return new Rect(
                { x: newX, y: bounds.minY },
                { width: bounds.maxX - newX, height: bounds.height, });
        }
    }
}

export function calcSpeedIncrement(speedInMeterPerHour: number, refreshIntervalInSecs: number): number {
  const speedInMeterPerSecs = speedInMeterPerHour / (60 * 60);
  return speedInMeterPerSecs * refreshIntervalInSecs;
}

