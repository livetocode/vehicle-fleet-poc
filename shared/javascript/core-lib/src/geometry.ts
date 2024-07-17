export const KM = 1000;

export interface Point {
    x: number;
    y: number;
}

export interface GpsCoordinates {
    lat: number;
    lon: number;
    alt: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Range {
    min: number;
    max: number;
}

export interface IRect {
    origin: Point;
    size: Size;
}

export class Rect {
    constructor(
        public readonly origin: Readonly<Point>, 
        public readonly size: Readonly<Size>, 
    ) { 
        if (size.width < 0) {
            throw new Error('Size widh cannot be negative');
        }
        if (size.height < 0) {
            throw new Error('Size height cannot be negative');
        }
    }

    static empty: Readonly<Rect> = new Rect(
        { x: 0, y: 0 },
        { width: 0, height: 0 },
    );

    static null: Readonly<Rect> = new Rect(
        { x: 0, y: 0 },
        { width: 0, height: 0 },
    );

    static fromCoordinates(x1: number, y1: number, x2: number, y2: number): Rect {
        const _x1 = Math.min(x1, x2);
        const _x2 = Math.max(x1, x2);
        const _y1 = Math.min(y1, y2);
        const _y2 = Math.max(y1, y2);
        return new Rect(
            { x: _x1, y : _y1 },
            { width: _x2 - _x1, height: _y2 - _y1 },
        );
    }

    get height() { return this.size.height; }
    get width() { return this.size.width; }
    get minX() { return this.origin.x; }
    get maxX() { return this.origin.x + this.size.width; }
    get midX() { return (this.minX + this.maxX) / 2; }
    get minY() { return this.origin.y; }
    get maxY() { return this.origin.y + this.size.height; }
    get midY() { return (this.minY + this.maxY) / 2; }


    toString() {
        if (this.isNull) {
            return '<Null>';
        }
        return `(${this.minX.toFixed(2)}, ${this.minY.toFixed(2)}, ${this.maxX.toFixed(2)}, ${this.maxY.toFixed(2)})`;
    }

    get isNull(): boolean {
        return this === Rect.null;
    }

    get isEmpty() {
        if (this === Rect.empty) {
            return true;
        }
        return this.size.width === 0 || this.size.height === 0;
    }

    containsPoint(p: Point): boolean {
        if (this.isNull) {
            return false;
        }
        return p.x >= this.minX &&
            p.x < this.maxX &&
            p.y >= this.minY &&
            p.y < this.maxY;
    }

    containsBounds(other: Rect) {
        if (this.isNull || other.isNull) {
            return false;
        }
        return this.containsPoint(other.origin) && 
            this.containsPoint(offsetPoint({x: other.maxX, y: other.maxY}, -1, -1));
    }

    intersectsWith(other: Rect): boolean {
        if (this.isNull || other.isNull) {
            return false;
        }
        return this.minX <= other.maxX &&
            this.maxX >= other.minX &&
            this.minY <= other.maxY &&
            this.maxY >= other.minY;
    }

    getRandomPosition(): Point {
        return {
            x: Math.trunc(this.origin.x + (this.size.width - 1) * Math.random()),
            y: Math.trunc(this.origin.y + (this.size.height - 1) * Math.random()),
        };
    }

    union(other: Rect): Rect {
        if (this.isNull) {
            return other;
        }
        if (other.isNull) {
            return this;
        }
        return Rect.fromCoordinates(
            Math.min(this.minX, other.minX),
            Math.min(this.minY, other.minY),
            Math.max(this.maxX, other.maxX),
            Math.max(this.maxY, other.maxY),
        );
    }

    intersect(other: Rect): Rect {
        if (this.isNull || other.isNull) {
            return Rect.null;
        }
        if (!this.intersectsWith(other)) {
            return Rect.null;
        }
        return Rect.fromCoordinates(
            Math.max(this.minX, other.minX),
            Math.max(this.minY, other.minY),
            Math.min(this.maxX, other.maxX),
            Math.min(this.maxY, other.maxY),
        );
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

export function offsetPoint(p : Point, dx: number, dy: number) : Point {
    return {
        x: p.x + dx,
        y: p.y + dy,
    }
}

export function formatPoint(p: Point): string {
    return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
}

export function pointToSize(p: Point): Size {
    return {
        width: p.x,
        height: p.y,
    }
}

export function rad2deg(rad: number): number {
    return (rad * 180) / (Math.PI);
}

export function deg2rad(deg: number): number {
    return (deg * Math.PI) / (180);
}

export function addOffsetToCoordinates(coords: GpsCoordinates, offsetX: number, offsetY: number) {
    const earthRadius = 6378137; // Rayon de la Terre en mètres (utilisé pour le WGS84)

    // Conversion des offsets en radians
    const dLat = offsetY / earthRadius;
    const dLon = offsetX / (earthRadius * Math.cos(deg2rad(coords.lat)));

    // Conversion des décalages en degrés
    const newLat = coords.lat + rad2deg(dLat);
    const newLon = coords.lon + rad2deg(dLon);

    return { lat: newLat, lon: newLon, alt: coords.alt };
}
