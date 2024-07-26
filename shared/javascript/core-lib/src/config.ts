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

export interface GeneratorConfig {
    verbose: boolean;
    vehicleCount: number;
    maxNumberOfEvents: number;
    refreshIntervalInSecs: number;
    realtime: boolean;
    sendFlush: boolean;
    terminateCollector: boolean;
}

export interface FileOutputConfig {
    type: 'file';
    folder: string;
    formats: string[];
}

export interface S3OutputConfig {
    type: 's3';
    formats: string[];
    // TODO: define properties for S3
}

export type OutputConfig = 
    | FileOutputConfig 
    | S3OutputConfig;

export interface CollectorConfig {
    verbose: boolean;
    collectorCount: number;
    // TODO: add timePartition and dataPartition sections
    aggregationWindowInMin: number;
    geohashLength: number;
    splitByGeohash: boolean;
    eventStore: EventStoreConfig;
    output: OutputConfig;
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
