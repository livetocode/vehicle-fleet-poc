import { GpsCoordinates, IRect, Point } from "./geometry.js";

export interface MyRequest {
    id: string;
    replyTo: string;
}

export interface MyResponse {
    requestId: string;
}

export interface StartGenerationCommand {
    type: 'start-generation';
    vehicleCount: number;
    vehicleTypes: string[];
    maxNumberOfEvents: number;
    refreshIntervalInSecs: number;
    realtime: boolean;
    sendFlush: boolean;
    startDate?: string;
}

export interface GeneratePartitionCommand {
    type: 'generate-partition';
    startDate: string;
    maxNumberOfEvents: number;
    request: StartGenerationCommand;
}

export interface GeneratePartitionStats {
    type: 'generate-partition-stats';
    generatedEventCount: number;
    elapsedTimeInMS: number;
}

export interface GenerationStats {
    type: 'generation-stats';
    elapsedTimeInMS: number;
}

export interface MoveCommand {
    type: 'move';
    vehicleId: string;
    vehicleType: string;
    zoneId?: string;
    direction: string;
    speed: number;
    gps: GpsCoordinates;
    timestamp: string;
}

export interface FlushRequest {
    type: 'flush-request';
}

export interface FlushResponse {
    type: 'flush-response';
}

export type Command =
  | MoveCommand
  | FlushRequest;

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
    totalElapsedTimeInMS: number;
    processStats: ProcessStats;
    totalRejectedMessagesInThePast: number;
    totalRejectedMessagesInTheFuture: number;
}

export interface ResetAggregatePeriodStats {
    type: 'reset-aggregate-period-stats',
}

export interface VehicleQuery extends MyRequest {
    type: 'vehicle-query';
    fromDate: string;
    toDate: string;
    polygon: GpsCoordinates[];
    vehicleTypes: string[],
    limit?: number;
    timeout?: number;
    ttl?: string;
    parallelize?: boolean;
    useChunking?: boolean;
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
    processedBytes: number;
    processedRecordCount: number;
    selectedRecordCount: number;
    distinctVehicleCount: number;
    elapsedTimeInMS: number;
    timeoutExpired: boolean;
    limitReached: boolean;
}

export interface VehicleQueryPartition {
    type: 'vehicle-query-partition';
    partitionQueryId: string;
    replyTo: string;
    query: VehicleQuery;
    filename: string;
    filesize: number;
}

export interface VehicleQueryPartitionResultStats {
    type: 'vehicle-query-partition-result-stats';
    partitionQueryId: string;
    stats: VehicleQueryResultStats;
    distinctVehicleIds: string[];
}

export interface ClearVehiclesData {
    type: 'clear-vehicles-data';
}

export interface ClearVehiclesDataResult {
    type: 'clear-vehicles-data-result';
    success: boolean;
}
