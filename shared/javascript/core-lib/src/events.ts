import { GpsCoordinates, IRect, Point } from "./geometry.js";


export interface MoveCommand {
    type: 'move';
    vehicleId: string;
    zone: {
        id: string;
        bounds: IRect;
    }
    regionBounds: IRect;
    location: Point;
    direction: string;
    speed: number;
    gps: GpsCoordinates;
    timestamp: string;
}

export interface FlushCommand {
    type: 'flush';
    exitProcess: boolean;
}

export type Command =
  | MoveCommand
  | FlushCommand;


export interface DataPartitionStats {
    url: string;
    size: number;
    format: string;
    itemCount: number;
    partitionKey: string;
    elapsedTimeInMS: number;
}  

export interface AggregatePeriodStats {
    type: 'aggregate-period-stats',
    collectorCount: number;
    collectorIndex: number;
    fromTime: string;
    toTime: string;
    partitionKey: string;
    eventCount: number;
    partitions: DataPartitionStats[];
    formats: string[];
    elapsedTimeInMS: number;
}

export interface ResetAggregatePeriodStats {
    type: 'reset-aggregate-period-stats',
}