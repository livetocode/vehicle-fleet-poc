use anyhow::Context;
use log::LevelFilter;
use serde::{Deserialize, Serialize};
use serde_yaml;
use std::fs;

// Si GpsCoordinates n'est pas une simple paire de floats, il faut l'importer
// En supposant que c'est une simple structure:
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpsCoordinates {
    pub lat: f64,
    pub lon: f64,
    pub alt: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warn,
    Debug,
    Trace,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoggingConfig {
    pub enabled: bool,
    pub level: LogLevel,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum HubConfig {
    #[serde(rename = "nats")]
    NatsHubConfig {
        #[serde(default)]
        enableProtoBuf: bool,
        protocols: NatsProtocols,
    },
    #[serde(rename = "azureServiceBus")]
    AzureServiceBusHubConfig {
        #[serde(default)]
        enableProtoBuf: bool,
        connectionString: String,
    },
    #[serde(rename = "rabbit")]
    RabbitHubConfig {
        #[serde(default)]
        enableProtoBuf: bool,
        // todo: define other properties
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NatsProtocols {
    pub nats: NatsServers,
    pub websockets: WebsocketServers,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NatsServers {
    pub servers: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WebsocketServers {
    pub servers: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum EventStoreConfig {
    #[serde(rename = "noop")]
    NoopEventStoreConfig,
    #[serde(rename = "memory")]
    InMemoryEventStoreConfig,
    #[serde(rename = "duckdb")]
    DuckDbEventStoreConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum DataPartitionStrategyConfig {
    #[serde(rename = "geohash")]
    GeohashDataPartitionStrategyConfig { hashLength: u8 },
    #[serde(rename = "id")]
    IdDataPartitionStrategyConfig,
    #[serde(rename = "idGroup")]
    IdGroupDataPartitionStrategyConfig { groupSize: u32 },
    #[serde(rename = "collectorIndex")]
    CollectorIndexDataPartitionStrategyConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimePartitioningConfig {
    pub aggregationPeriodInMin: u32,
    pub maxCapacity: u32,
    pub maxActivePartitions: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PartitioningConfig {
    pub timePartition: TimePartitioningConfig,
    pub dataPartition: DataPartitionStrategyConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackpressureConfig {
    pub enabled: bool,
    pub notificationThreshold: u32,
    pub notificationPeriodInMS: u32,
    pub waitTimeoutInMS: u32,
    pub waitThreshold: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChaosEngineeringConfig {
    pub enabled: bool,
    pub messageReadDelayInMS: u32,
    pub messageWriteDelayInMS: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MapConfig {
    pub topLeftOrigin: GpsCoordinates,
    pub widthInKm: f64,
    pub heightInKm: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZoneSize {
    pub widthInKm: f64,
    pub heightInKm: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneratorConfig {
    pub logging: LoggingConfig,
    pub instances: u32,
    pub httpPort: u16,
    pub vehicleCount: u32,
    pub vehicleTypes: Vec<String>,
    pub maxNumberOfEvents: u64,
    pub messageChunkSize: u32,
    pub refreshIntervalInSecs: u32,
    pub realtime: bool,
    pub sendFlush: bool,
    pub startDate: Option<String>,
    pub map: MapConfig,
    pub zoneSize: ZoneSize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum StorageConfig {
    #[serde(rename = "file")]
    FileStorageConfig { folder: String },
    #[serde(rename = "noop")]
    NoOpStorageConfig,
    #[serde(rename = "s3")]
    S3StorageConfig,
    #[serde(rename = "azure-blob")]
    AzureBlobStorageConfig {
        connectionString: Option<String>,
        containerName: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutputConfig {
    pub overwriteExistingFiles: bool,
    pub flatLayout: bool,
    pub formats: Vec<String>,
    pub storage: StorageConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ConcreteEventDispatcherConfig {
    #[serde(rename = "messageBus")]
    MessageBusEventDispatcherConfig,
    #[serde(rename = "azureEventHub")]
    AzureEventHubEventDispatcherConfig {
        connectionString: String,
        sendDelayInMS: u32,
        sendParallelism: u32,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum EventDispatcherConfig {
    #[serde(rename = "proxy")]
    ProxyEventDispatcherConfig {
        dispatchers: Vec<ConcreteEventDispatcherConfig>,
    },
    // Le type `ConcreteEventDispatcherConfig` est aussi un `EventDispatcherConfig`
    #[serde(untagged)]
    Concrete(ConcreteEventDispatcherConfig),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectorConfig {
    pub logging: LoggingConfig,
    pub instances: u32,
    pub httpPort: u16,
    pub geohashLength: u8,
    pub eventStore: EventStoreConfig,
    pub eventDispatcher: EventDispatcherConfig,
    pub output: OutputConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum FinderDataSourceConfig {
    #[serde(rename = "file")]
    FinderFileDataSourceConfig,
    #[serde(rename = "azureSql")]
    FinderAzureSqlDataSourceConfig {
        connection: FinderAzureSqlConnection,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinderAzureSqlConnection {
    pub server: String,
    pub database: Option<String>,
    pub authentication: serde_json::Value, // `any` type in Rust often maps to `serde_json::Value`
    pub options: FinderAzureSqlConnectionOptions,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinderAzureSqlConnectionOptions {
    pub encrypt: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FinderConfig {
    pub logging: LoggingConfig,
    pub runtime: String, // 'nodejs' | 'rust'
    pub instances: u32,
    pub httpPort: u16,
    pub defaultTimeoutInMS: u128,
    pub dataFormat: String,
    pub parallelSearch: bool,
    pub useChunking: bool,
    pub messageChunkSize: u32,
    pub dataSource: FinderDataSourceConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ViewerConfig {
    pub logging: LoggingConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub hub: HubConfig,
    pub partitioning: PartitioningConfig,
    pub backpressure: BackpressureConfig,
    pub chaosEngineering: ChaosEngineeringConfig,
    pub generator: GeneratorConfig,
    pub collector: CollectorConfig,
    pub finder: FinderConfig,
    pub viewer: ViewerConfig,
}

pub fn load_config(filename: &str) -> anyhow::Result<crate::config::Config> {
    let file_content = fs::read_to_string(filename)
        .with_context(|| format!("Could not read config file: {}", filename))?;

    let config: crate::config::Config = serde_yaml::from_str(&file_content)
        .with_context(|| format!("Could not deserialize config from file: {}", filename))?;

    Ok(config)
}

pub fn str_to_log_level(value: &LogLevel) -> LevelFilter {
    match value {
        LogLevel::Debug => LevelFilter::Debug,
        LogLevel::Error => LevelFilter::Error,
        LogLevel::Info => LevelFilter::Info,
        LogLevel::Trace => LevelFilter::Trace,
        LogLevel::Warn => LevelFilter::Warn,
    }
}
