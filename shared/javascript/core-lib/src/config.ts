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

export interface GeneratorConfig {
    verbose: boolean;
    generatorCount: number;
    vehicleCount: number;
    maxNumberOfEvents: number;
    refreshIntervalInSecs: number;
    realtime: boolean;
    sendFlush: boolean;
    terminateCollector: boolean;
    dataPartition: DataPartitionStrategyConfig;
}

export interface FileOutputConfig {
    type: 'file';
    folder: string;
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
    verbose: boolean;
    collectorCount: number;
    // TODO: replace with timePartition section?
    aggregationPeriodInMin: number;
    geohashLength: number;
    eventStore: EventStoreConfig;
    output: OutputConfig;
    dataPartition: DataPartitionStrategyConfig;
}  

export interface ViewerConfig {
    verbose: boolean;
}

export interface Config {
    hub: HubConfig;
    generator: GeneratorConfig;
    collector: CollectorConfig;  
    viewer: ViewerConfig;
}
