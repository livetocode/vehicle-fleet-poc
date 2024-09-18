import { GpsCoordinates } from "./geometry";

export type LogLevel = 'info' | 'warn' | 'debug' | 'trace' | 'error';

export interface LoggingConfig {
    enabled: boolean;
    level: LogLevel;
}

export interface NatsHubConfig {
    type: 'nats';
    protocols: {
        nats: {
            servers: string[];                
        },
        websockets: {
            servers: string[];                
        }
    }
}

export interface RabbitHubConfig {
    type: 'rabbit';
    // todo: define other properties
}

export type HubConfig = NatsHubConfig | RabbitHubConfig;

export interface NoopEventStoreConfig {
    type: 'noop';
}

export interface InMemoryEventStoreConfig {
    type: 'memory';
}

export interface DuckDbEventStoreConfig {
    type: 'duckdb';
}

export type EventStoreConfig = 
  | NoopEventStoreConfig
  | InMemoryEventStoreConfig
  | DuckDbEventStoreConfig;


export interface GeohashDataPartitionStrategyConfig {
    type: 'geohash';
    hashLength: number;
}

export interface IdDataPartitionStrategyConfig {
    type: 'id';
}

export interface IdGroupDataPartitionStrategyConfig {
    type: 'idGroup';
    groupSize: number;
}

export interface CollectorIndexDataPartitionStrategyConfig {
    type: 'collectorIndex';
}

export type DataPartitionStrategyConfig =
  | GeohashDataPartitionStrategyConfig
  | IdDataPartitionStrategyConfig
  | IdGroupDataPartitionStrategyConfig
  | CollectorIndexDataPartitionStrategyConfig;

export type TimePartitioningConfig = {
    aggregationPeriodInMin: number; 
    maxCapacity: number;
}

export type PartitioningConfig = {
    timePartition: TimePartitioningConfig;
    dataPartition: DataPartitionStrategyConfig;
}

export type MapConfig = {
    topLeftOrigin: GpsCoordinates;
    widthInKm: number;
    heightInKm: number;
}

export type ZoneSize = {
    widthInKm: number;
    heightInKm: number;
}

export interface GeneratorConfig {
    logging: LoggingConfig;
    generatorCount: number;
    vehicleCount: number;
    maxNumberOfEvents: number;
    refreshIntervalInSecs: number;
    realtime: boolean;
    sendFlush: boolean;
    terminateCollector: boolean;
    startDate?: string;
    map: MapConfig;
    zoneSize: ZoneSize;
}

export interface FileOutputConfig {
    type: 'file';
    folder: string;
    flatLayout: boolean;
    formats: string[];
}

export interface NoOpOutputConfig {
    type: 'noop';
}

export interface S3OutputConfig {
    type: 's3';
    formats: string[];
    // TODO: define properties for S3
}

export type OutputConfig = 
    | FileOutputConfig 
    | NoOpOutputConfig
    | S3OutputConfig;

export interface CollectorConfig {
    logging: LoggingConfig;
    collectorCount: number;
    geohashLength: number;
    eventStore: EventStoreConfig;
    output: OutputConfig;
}  

export interface QuerierConfig {
    logging: LoggingConfig;
    querierCount: number;
    defaultTimeoutInMS: number;
    autoStart: boolean;
}

export interface ViewerConfig {
    logging: LoggingConfig;
}

export interface Config {
    hub: HubConfig;
    partitioning: PartitioningConfig;
    generator: GeneratorConfig;
    collector: CollectorConfig;  
    querier: QuerierConfig;
    viewer: ViewerConfig;
}
