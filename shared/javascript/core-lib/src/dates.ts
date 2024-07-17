export function dateToUtcParts(date: Date): string[] {
    return [
        date.getUTCFullYear().toString(),
        (date.getUTCMonth() + 1).toString().padStart(2, '0'),
        date.getUTCDate().toString().padStart(2, '0'),
        date.getUTCHours().toString().padStart(2, '0'),
        date.getUTCMinutes().toString().padStart(2, '0'),
    ];
}

export interface Comparable {
    toString(): string;
    compareTo(other: Comparable): number;
}

export class TimeRange implements Comparable {
    constructor(
        public readonly fromTime: Date,
        public readonly untilTime: Date,
    ) {}

    compareTo(other: TimeRange) {
        return compareTimeRange(this, other);
    }

    toString() {
        return formatTimeRange(this);
    }
}

export function calcTimeWindow(date: Date, windowInMin: number): TimeRange {
    const dateInMS = date.getTime();
    const windowInMS = windowInMin * 60 * 1000;
    const delta = dateInMS % windowInMS;
    const fromTime = new Date(dateInMS - delta);
    const untilTime = new Date(fromTime.getTime() + windowInMS);
    return new TimeRange(fromTime, untilTime);
}

export function compareTimeRange(a: TimeRange, b: TimeRange): number {
    const afrom = a.fromTime.getTime();
    const bfrom = b.fromTime.getTime();
    const delta = afrom - bfrom;
    if (delta === 0) {
        const auntil = a.untilTime.getTime();
        const buntil = b.untilTime.getTime();
        return auntil - buntil;    
    }
    return delta;
}

export function formatTimeRange(range: TimeRange): string {
    return dateToUtcParts(range.fromTime).join('-');
}