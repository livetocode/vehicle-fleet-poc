import { roundDecimals } from "./math.js";

export interface InternalClock {
    measure(start?: unknown): unknown;
    elapsedTimeInMS(start: unknown, end?: unknown): number;
}

function isHRTimeValue(value: unknown): value is [number, number]  {
    return Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';
}

export class NodeInternalClock implements InternalClock {
    measure(start?: unknown): unknown {
        if (start && isHRTimeValue(start)) {
            return process.hrtime(start);
        }
        return process.hrtime();
    }

    elapsedTimeInMS(start: unknown, end?: unknown): number {
        if (!isHRTimeValue(start)) {
            throw new Error('Expected start to be a hrtime value');
        }
        let hrend: [number, number] | undefined = undefined;
        if (end) {
            if (isHRTimeValue(end)) {
                hrend = end;
            } else {
                throw new Error('Expected end to be a hrtime value');
            }
        } else {
            hrend = process.hrtime(start);
        }
        
        return hrend[0] * 1000 + hrend[1] / 1000000;
    }

}

export class BrowserInternalClock implements InternalClock {
    measure(start?: unknown): unknown {
        return new Date();
    }
    elapsedTimeInMS(start: unknown, end?: unknown): number {
        if (!(start instanceof Date)) {
            throw new Error('Expected start to be a Date value');
        }
        let endDate: Date | undefined = undefined;
        if (end) {
            if (!(end instanceof Date)) {
                throw new Error('Expected end to be a Date value');
            }
            endDate = end;
        } else {
            endDate = new Date();
        }
        return endDate.getTime() - start.getTime();
    }
}

function createDefaultInternalClock(): InternalClock {
    try {
        const result = new NodeInternalClock();
        result.measure(); // try to use process.hrtime
        return result;

    } catch {
        return new BrowserInternalClock();
    }
}

const internalClock = createDefaultInternalClock();


export class Stopwatch {
    private _start?: unknown;
    private _end?: unknown;
    private _internalClock: InternalClock;

    constructor() {
        this._internalClock = internalClock;
    }

    public isStarted() {
        return !!this._start;
    }

    public isStopped() {
        return !!this._end;
    }

    public start() {
        if (this.isStarted()) {
            throw new Error('You can start an already started watch!');
        }
        this._start =this._internalClock.measure();
        this._end = undefined;
    }

    public stop() {
        this.ensureStarted();
        this._end = this._internalClock.measure(this._start);
    }

    public reset() {
        this._start = undefined;
        this._end = undefined;
    }

    public restart() {
        this.reset();
        this.start();
    }

    public elapsedTimeInMS() {
        this.ensureStarted();
        return roundDecimals(this._internalClock.elapsedTimeInMS(this._start, this._end), 2);
    }

    public elapsedTimeInSecs() {
        this.ensureStarted();
        return roundDecimals(this._internalClock.elapsedTimeInMS(this._start, this._end) / 1000, 2);
    }
    
    public elapsedTimeAsString() {
        const elapsedInMS = this.elapsedTimeInMS();
        if (elapsedInMS < 1001) {
            return `${elapsedInMS} ms`;
        }
        const secs = roundDecimals(elapsedInMS / 1000, 2);
        if (secs < 61) {
            return `${secs} secs`;
        }
        const minutes = roundDecimals(secs / 60, 2);
        if (minutes < 61) {
            return `${minutes} minutes`;
        }
        const hours = roundDecimals(minutes / 60, 2);
        if (hours < 25) {
            return `${minutes} hours`;
        }
        const days = roundDecimals(hours / 24, 2);
        return `${days} days`;
    }

    public toString() {
        if (this.isStarted()) {
            return `Watch running after ${this.elapsedTimeAsString()}`;
        }
        if (this.isStopped()) {
            return `Watch stopped after ${this.elapsedTimeAsString()}`;
        }
        return 'Watch is empty';
    }

    private ensureStarted() {
        if (!this.isStarted()) {
            throw new Error('You must start the watch before calling this method');
        }
    }
}
