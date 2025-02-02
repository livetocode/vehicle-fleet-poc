import { GpsCoordinates } from "./geometry.js";
import { TypedMessage } from "./messaging/TypedMessage.js";
import { Request } from "./messaging/Requests.js";

export interface GenerateRequest {
    type: 'generate-request';
    vehicleCount: number;
    vehicleTypes: string[];
    maxNumberOfEvents: number;
    refreshIntervalInSecs: number;
    realtime: boolean;
    sendFlush: boolean;
    startDate?: string;
    pauseDelayInMSecs?: number;
}

export interface GenerateResponse {
    type: 'generate-response';
    elapsedTimeInMS: number;
}

export interface GeneratePartitionRequest {
    type: 'generate-partition-request';
    startDate: string;
    maxNumberOfEvents: number;
    request: GenerateRequest;
}

export interface GeneratePartitionResponse {
    type: 'generate-partition-response';
    generatedEventCount: number;
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

export interface EnrichedMoveCommand {
    type: 'enriched-move';
    command: MoveCommand;
    collectorIndex: number;
    geoHash: string;
    partitionKey: string;
}


export interface FlushRequest {
    type: 'flush-request';
}

export interface FlushResponse {
    type: 'flush-response';
}

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


export interface VehicleQueryRequest {
    type: 'vehicle-query-request';
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

export interface VehicleQueryResponse {
    type: 'vehicle-query-response';
    processedFilesCount: number;
    processedBytes: number;
    processedRecordCount: number;
    selectedRecordCount: number;
    distinctVehicleCount: number;
    elapsedTimeInMS: number;
    timeoutExpired: boolean;
    limitReached: boolean;
}

export type VehicleQueryStartedEvent = {
    type: 'vehicle-query-started';
    query: Request<VehicleQueryRequest>;
}

export type VehicleQueryStoppedEvent = {
    type: 'vehicle-query-stopped';
    query: Request<VehicleQueryRequest>;
    response: VehicleQueryResponse;
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

export interface VehicleQueryPartitionRequest {
    type: 'vehicle-query-partition-request';
    query: Request<VehicleQueryRequest>;
    filename: string;
    filesize: number;
}

export interface VehicleQueryPartitionResponse {
    type: 'vehicle-query-partition-response';
    partialResponse: VehicleQueryResponse;
    distinctVehicleIds: string[];
}

export interface ClearVehiclesDataRequest {
    type: 'clear-vehicles-data-request';
}

export interface ClearVehiclesDataResponse {
    type: 'clear-vehicles-data-response';
    success: boolean;
}

export function isVehicleQueryPartitionResponse(msg: TypedMessage): msg is VehicleQueryPartitionResponse {
    return msg.type === 'vehicle-query-partition-response';
}

export function isGenerateResponse(msg: TypedMessage): msg is GenerateResponse {
    return msg.type === 'generate-response';
}

export function isVehicleQueryResponse(msg: TypedMessage): msg is VehicleQueryResponse {
    return msg.type === 'vehicle-query-response';
}

export function isClearVehiclesDataResponse(msg: TypedMessage): msg is ClearVehiclesDataResponse {
    return msg.type === 'clear-vehicles-data-response';
}