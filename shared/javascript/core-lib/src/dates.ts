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

export function isBefore(a: Date, b: Date): boolean {
    return a.getTime() < b.getTime();
}

export function isBeforeOrEqual(a: Date, b: Date): boolean {
    return a.getTime() <= b.getTime();
}

export function addYears(dt: Date, years: number): Date {
    const result = new Date(dt);
    result.setUTCFullYear(result.getUTCFullYear() + years);
    return result;
}

export function addMonths(dt: Date, months: number): Date {
    const result = new Date(dt);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
}

export function addDays(dt: Date, days: number): Date {
    const result = new Date(dt);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

export function addHours(dt: Date, hours: number): Date {
    const result = new Date(dt);
    result.setUTCHours(result.getUTCHours() + hours);
    return result;
}

export function addMinutes(dt: Date, minutes: number): Date {
    const result = new Date(dt);
    result.setUTCMinutes(result.getUTCMinutes() + minutes);
    return result;
}

export function isBeginningOfYear(dt: Date): boolean {
    return dt.getUTCMonth() === 0 && dt.getUTCDate() === 1 && dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0;
}

export function isBeginningOfMonth(dt: Date): boolean {
    return dt.getUTCDate() === 1 && dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0;
}

export function isBeginningOfDay(dt: Date): boolean {
    return dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0;
}

export function isBeginningOfHour(dt: Date): boolean {
    return dt.getUTCMinutes() === 0;
}

export function* generateTimePrefixes(startDate: Date, endDate: Date, windowInMin: number) {
  if (startDate.getTime() >= endDate.getTime()) {
    throw new Error(`startDate ${startDate.toISOString()} must be before endDate ${endDate.toISOString()}`);
  }
  let cursor = calcTimeWindow(startDate, windowInMin).fromTime;

  while (isBefore(cursor, endDate)) {
    const parts = dateToUtcParts(cursor)
    if (
      isBeginningOfYear(cursor) &&
      isBeforeOrEqual(addYears(cursor, 1), endDate)
    ) {
      yield parts.slice(0, 1);
      cursor = addYears(cursor, 1);
      continue;
    }

    if (
      isBeginningOfMonth(cursor) &&
      isBeforeOrEqual(addMonths(cursor, 1), endDate)
    ) {
      yield parts.slice(0, 2);
      cursor = addMonths(cursor, 1);
      continue;
    }

    if (
      isBeginningOfDay(cursor) &&
      isBeforeOrEqual(addDays(cursor, 1), endDate)
    ) {
      yield parts.slice(0, 3);
      cursor = addDays(cursor, 1);
      continue;
    }

    if (
      isBeginningOfHour(cursor) &&
      isBeforeOrEqual(addHours(cursor, 1), endDate)
    ) {
      yield parts.slice(0, 4);
      cursor = addHours(cursor, 1);
      continue;
    }
    
    yield parts;

    cursor = addMinutes(cursor, windowInMin);
  }
}
