import { GpsCoordinates } from "./geometry.js";
import { TypedMessage } from "./messaging/TypedMessage.js";
import { Request } from "./messaging/Requests.js";

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

export interface AggregatePeriodCreated {
    type: 'aggregate-period-created';
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

export interface VehicleGenerationStarted {
    type: 'vehicle-generation-started';
    timestamp: string;
}

export interface VehicleGenerationStopped {
    type: 'vehicle-generation-stopped';
    success: boolean;
    timestamp: string;
    elapsedTimeInMS: number;
}


export interface VehicleQuery {
    type: 'vehicle-query';
    id: string;
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

export type VehicleQueryStartedEvent = {
    type: 'vehicle-query-started';
    query: Request<VehicleQuery>;
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
    query: Request<VehicleQuery>;
    filename: string;
    filesize: number;
}

export interface VehicleQueryPartitionResultStats {
    type: 'vehicle-query-partition-result-stats';
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

export function isVehicleQueryPartitionResultStats(msg: TypedMessage): msg is VehicleQueryPartitionResultStats {
    return msg.type === 'vehicle-query-partition-result-stats';
}