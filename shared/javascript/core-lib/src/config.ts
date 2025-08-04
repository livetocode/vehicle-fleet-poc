import { GpsCoordinates } from "./geometry.js";

export type LogLevel = 'info' | 'warn' | 'debug' | 'trace' | 'error';

export type LoggingConfig = {
    enabled: boolean;
    level: LogLevel;
}

export type NatsHubConfig = {
    type: 'nats';
    enableProtoBuf: boolean;
    protocols: {
        nats: {
            servers: string[];                
        },
        websockets: {
            servers: string[];                
        }
    }
}

export type AzureServiceBusHubConfig = {
    type: 'azureServiceBus';
    enableProtoBuf: boolean;
    connectionString: string;
}

export type RabbitHubConfig = {
    type: 'rabbit';
    enableProtoBuf: boolean;
    // todo: define other properties
}

export type HubConfig = NatsHubConfig | AzureServiceBusHubConfig | RabbitHubConfig;

export type NoopEventStoreConfig = {
    type: 'noop';
}

export type InMemoryEventStoreConfig = {
    type: 'memory';
}

export type DuckDbEventStoreConfig = {
    type: 'duckdb';
}

export type EventStoreConfig = 
  | NoopEventStoreConfig
  | InMemoryEventStoreConfig
  | DuckDbEventStoreConfig;


export type GeohashDataPartitionStrategyConfig = {
    type: 'geohash';
    hashLength: number;
}

export type IdDataPartitionStrategyConfig = {
    type: 'id';
}

export type IdGroupDataPartitionStrategyConfig = {
    type: 'idGroup';
    groupSize: number;
}

export type CollectorIndexDataPartitionStrategyConfig = {
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
    maxActivePartitions: number;
}

export type PartitioningConfig = {
    timePartition: TimePartitioningConfig;
    dataPartition: DataPartitionStrategyConfig;
}

export type BackpressureConfig = {
    enabled: boolean;
    notificationThreshold: number;
    notificationPeriodInMS: number;
    waitTimeoutInMS: number;
    waitThreshold: number;
}

export type ChaosEngineeringConfig = {
    enabled: boolean;
    messageReadDelayInMS: number;
    messageWriteDelayInMS: number;
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

export type GeneratorConfig = {
    logging: LoggingConfig;
    instances: number;
    httpPort: number;
    vehicleCount: number;
    vehicleTypes: string[];
    maxNumberOfEvents: number;
    messageChunkSize: number;
    refreshIntervalInSecs: number;
    realtime: boolean;
    sendFlush: boolean;
    startDate?: string;
    map: MapConfig;
    zoneSize: ZoneSize;
}

export type FileStorageConfig = {
    type: 'file';
    folder: string;
}

export type NoOpStorageConfig = {
    type: 'noop';
}

export type S3StorageConfig = {
    type: 's3';
}

export type AzureBlobStorageConfig = {
    type: 'azure-blob';
    connectionString?: string;
    containerName: string;
}

export type StorageConfig = 
    | FileStorageConfig 
    | NoOpStorageConfig
    | S3StorageConfig
    | AzureBlobStorageConfig;

export type OutputConfig = {
    overwriteExistingFiles: boolean;
    flatLayout: boolean;
    formats: string[];
    storage: StorageConfig;
}

export type MessageBusEventDispatcherConfig = {
    type: 'messageBus'
}

export type AzureEventHubEventDispatcherConfig = {
    type: 'azureEventHub'
    connectionString: string;
    sendDelayInMS: number;
    sendParallelism: number;
}

export type ConcreteEventDispatcherConfig = MessageBusEventDispatcherConfig | AzureEventHubEventDispatcherConfig;

export type ProxyEventDispatcherConfig = {
    type: 'proxy'
    dispatchers: ConcreteEventDispatcherConfig[];
}

export type EventDispatcherConfig = ConcreteEventDispatcherConfig | ProxyEventDispatcherConfig;

export type CollectorConfig = {
    logging: LoggingConfig;
    instances: number;
    httpPort: number;
    geohashLength: number;
    eventStore: EventStoreConfig;
    eventDispatcher: EventDispatcherConfig;
    output: OutputConfig;
}  

export type FinderConfig = {
    logging: LoggingConfig;
    instances: number;
    httpPort: number;
    defaultTimeoutInMS: number;
    dataFormat: string;
    parallelSearch: boolean;
    useChunking: boolean;
    messageChunkSize: number;
}

export type ViewerConfig = {
    logging: LoggingConfig;
}

export type Config = {
    hub: HubConfig;
    partitioning: PartitioningConfig;
    backpressure: BackpressureConfig;
    chaosEngineering: ChaosEngineeringConfig;
    generator: GeneratorConfig;
    collector: CollectorConfig;  
    finder: FinderConfig;
    viewer: ViewerConfig;
}
