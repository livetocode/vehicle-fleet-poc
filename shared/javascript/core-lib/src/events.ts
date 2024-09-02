import { GpsCoordinates, IRect, Point } from "./geometry.js";


export interface MoveCommand {
    type: 'move';
    vehicleId: string;
    vehicleType: string;
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

export type ProcessMemory = {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}

export type ProcessStats = {
    memory: ProcessMemory;
    loadAverage: number[];
}

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
    isPartial: boolean;
    eventCount: number;
    partitions: DataPartitionStats[];
    formats: string[];
    elapsedTimeInMS: number;
    processStats: ProcessStats;
}

export interface ResetAggregatePeriodStats {
    type: 'reset-aggregate-period-stats',
}

export interface VehicleQuery {
    type: 'vehicle-query';
    id: string;
    fromDate: string;
    toDate: string;
    polygon: GpsCoordinates[];
    limit?: number;
    timeout?: number;
}

export interface VehicleQueryResult {
    type: 'vehicle-query-result';
    queryId: string;
    timestamp: string;
    vehicleId: string;
    vehicleType: string;
    gps: GpsCoordinates;
    direction: string;
    speed: number;
    geoHash: string;
}

export interface VehicleQueryResultStats {
    type: 'vehicle-query-result-stats';
    queryId: string;
    processedFilesCount: number;
    processedRecordCount: number;
    selectedRecordCount: number;
    elapsedTimeInMS: number;
    timeoutExpired: boolean;
}
