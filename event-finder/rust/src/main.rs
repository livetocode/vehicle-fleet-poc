#![allow(non_snake_case)]
use actix_web::{App, HttpServer};
use actix_web_prom::PrometheusMetricsBuilder;
use async_nats::ServerAddr;
use log;
use log::LevelFilter;
use simple_logger::SimpleLogger;
use std::env;
use std::string::ToString;
use std::sync::Arc;
mod config;
mod contexts;
mod handlers;
mod types;
mod utils;

pub mod types_proto {
    include!(concat!(env!("OUT_DIR"), "/types.proto.rs"));
}

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    let config = crate::config::load_config("../../config.yaml")?;
    let config = Arc::new(config);
    if config.finder.logging.enabled {
        SimpleLogger::new()
            .with_level(LevelFilter::Warn)
            .with_module_level(
                "event_finder",
                crate::config::str_to_log_level(&config.finder.logging.level),
            )
            .env()
            .init()
            .unwrap();
    }
    let registry = prometheus::Registry::new();
    let counters = create_prometheus_counters(registry.clone());

    start_nats_handlers(&config, &counters).await?;

    start_web_server(&config, &counters).await
}

fn create_prometheus_counters(
    prometheus_registry: prometheus::Registry,
) -> contexts::PrometheusCounters {
    let vehicles_search_processed_events_total_counter = prometheus::IntCounterVec::new(
        prometheus::opts!(
            "vehicles_search_processed_events_total",
            "Number of events processed during a search by the event finder"
        ),
        &[],
    )
    .unwrap();

    prometheus_registry
        .register(Box::new(
            vehicles_search_processed_events_total_counter.clone(),
        ))
        .unwrap();

    contexts::PrometheusCounters {
        prometheus_registry,
        vehicles_search_processed_events_total_counter,
    }
}

async fn start_nats_handlers(
    config: &Arc<crate::config::Config>,
    prometheus_counters: &contexts::PrometheusCounters,
) -> anyhow::Result<()> {
    let nats_server_addresses = get_nats_servers(&config)?;
    let nats_client = async_nats::connect(nats_server_addresses).await?;
    log::info!("Connected to NATS servers");

    let identity = types::ServiceIdentity {
        name: "finder".to_string(),
        instance: get_instance_index(),
        runtime: "rust".to_string(),
    };

    let base_handler_ctx = contexts::HandlerContext {
        nats_client: nats_client.clone(),
        prometheus_counters: prometheus_counters.clone(),
        identity,
    };

    let session = handlers::search::create_session_context(&config).await?;
    let data_handler_ctx =
        contexts::DataHandlerContext::new(base_handler_ctx.clone(), config.clone(), session);

    handlers::search::subscribe_to_search_requests(data_handler_ctx.clone())?;
    handlers::search::subscribe_to_generation_requests(data_handler_ctx.clone())?;
    handlers::ping::subscribe_to_ping_requests(base_handler_ctx.clone())?;

    anyhow::Ok(())
}

async fn start_web_server(
    config: &Arc<crate::config::Config>,
    prometheus_counters: &contexts::PrometheusCounters,
) -> anyhow::Result<()> {
    let mut labels = std::collections::HashMap::new();
    labels.insert("service".to_string(), "finder".to_string());
    labels.insert("runtime".to_string(), "rust".to_string());

    let prometheus = PrometheusMetricsBuilder::new("api_metrics")
        .endpoint("/metrics")
        .registry(prometheus_counters.prometheus_registry.clone())
        .const_labels(labels)
        .build()
        .unwrap();

    let port: u16 = env::var("NODE_HTTP_PORT")
        .unwrap_or(config.finder.httpPort.to_string())
        .parse()
        .unwrap();

    log::info!("Listening on: http://127.0.0.1:{}", port);
    HttpServer::new(move || {
        App::new()
            .wrap(prometheus.clone())
            .service(handlers::ping::ping)
    })
    .bind(("127.0.0.1", port))?
    .run()
    .await?;
    log::info!("Web server stopped.");

    anyhow::Ok(())
}

fn get_instance_index() -> usize {
    if let Ok(instance_index) = std::env::var("INSTANCE_INDEX") {
        if !instance_index.is_empty() {
            if let Ok(val) = instance_index.parse::<usize>() {
                return val;
            }
        }
    }
    if let Ok(hostname) = std::env::var("HOSTNAME") {
        if let Some(idx) = hostname.rfind('-') {
            if idx + 1 < hostname.len() {
                let suffix = &hostname[idx + 1..];
                if !suffix.is_empty() {
                    if let Ok(val) = suffix.parse::<usize>() {
                        return val;
                    }
                }
            }
        }
    }
    0
}

pub fn get_nats_servers(config: &crate::config::Config) -> anyhow::Result<Vec<ServerAddr>> {
    let nats_protos = match &config.hub {
        crate::config::HubConfig::NatsHubConfig { protocols: p, .. } => p,
        _ => anyhow::bail!("Expected the hub to be configured for NATS"),
    };

    let NATS_SERVERS = env::var("NATS_SERVERS");
    let nats_servers = if NATS_SERVERS.is_ok() {
        &vec![NATS_SERVERS.unwrap().split(',').collect()]
    } else {
        &nats_protos.nats.servers
    };
    let nats_server_addresses: Vec<ServerAddr> = nats_servers
        .iter()
        .map(|s| s.parse::<ServerAddr>().unwrap())
        .collect();
    log::info!("Connecting to NATS servers: {:?}", nats_servers);
    Ok(nats_server_addresses)
}
