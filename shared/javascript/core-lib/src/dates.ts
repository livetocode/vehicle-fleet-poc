export function dateToUtcParts(date: Date): string[] {
    return [
        date.getUTCFullYear().toString(),
        (date.getUTCMonth() + 1).toString().padStart(2, '0'),
        date.getUTCDate().toString().padStart(2, '0'),
        date.getUTCHours().toString().padStart(2, '0'),
        date.getUTCMinutes().toString().padStart(2, '0'),
    ];
}

export const dateUtcPartNames = ['y', 'm', 'd', 'hh', 'mm'];
export function nameDateParts(parts: string[]): [string, string][] {
    return parts.map((part, index) => [dateUtcPartNames[index], part]);
}

export function dateToUtcPartsAsAttributes(date: Date) {
    const parts = dateToUtcParts(date);
    const result: any = {};
    for (const [k, v] of nameDateParts(parts)) {
        result[k] = v;
    }
    return result;
    // return {
    //     y: date.getUTCFullYear().toString(),
    //     m: (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    //     d: date.getUTCDate().toString().padStart(2, '0'),
    //     hh: date.getUTCHours().toString().padStart(2, '0'),
    //     mm: date.getUTCMinutes().toString().padStart(2, '0'),
    // };
}

export interface Comparable {
    toString(): string;
    compareTo(other: Comparable): number;
}

export class TimeRange implements Comparable {
    constructor(
        public readonly fromTime: Date,
        public readonly untilTime: Date,
    ) {
        if (fromTime.getTime() >= untilTime.getTime()) {
            throw new Error(`fromTime ${fromTime.toISOString()} must be before untilTime ${untilTime.toISOString()}`);
        }
    }

    compareTo(other: TimeRange) {
        return compareTimeRange(this, other);
    }

    includes(date: Date): boolean {
        return date.getTime() >= this.fromTime.getTime() && date.getTime() < this.untilTime.getTime();
    }

    get interval(): number {
        return this.untilTime.getTime() - this.fromTime.getTime();
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