#![allow(non_snake_case, )]
use std::env;
use std::string::ToString;
use actix_web::{App, HttpServer};
use actix_web_prom::{PrometheusMetricsBuilder};
use utils::errors::{to_datafusion_error };
mod types;
mod utils;
mod handlers;
mod contexts;

pub mod types_proto {
    include!(concat!(env!("OUT_DIR"), "/types.proto.rs"));
}

#[actix_web::main]
async fn main() -> datafusion::error::Result<()> {
    let registry = prometheus::Registry::new();
    let counters = create_prometheus_counters(registry.clone());

    start_nats_handlers(&counters).await?;

    start_web_server(&counters).await.map_err(to_datafusion_error)
}

fn create_prometheus_counters(prometheus_registry: prometheus::Registry) -> contexts::PrometheusCounters {
    let vehicles_search_processed_events_total_counter = prometheus::IntCounterVec::new(
        prometheus::opts!(
            "vehicles_search_processed_events_total",
            "Number of events processed during a search by the event finder"
        ),
        &[],
    )
    .unwrap();

    prometheus_registry.register(Box::new(vehicles_search_processed_events_total_counter.clone())).unwrap();

    contexts::PrometheusCounters {
        prometheus_registry,
        vehicles_search_processed_events_total_counter,
    }
}

async fn start_nats_handlers(prometheus_counters: &contexts::PrometheusCounters) -> datafusion::error::Result<()> {
    let NATS_SERVERS = env::var("NATS_SERVERS").unwrap_or("localhost".to_string());
    let nats_client = async_nats::connect(NATS_SERVERS).await.map_err(to_datafusion_error)?;
    println!("Connected to NATS");
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
    let session = handlers::search::create_session_context().await?;
    let data_handler_ctx = contexts::DataHandlerContext::new(base_handler_ctx.clone(), session);

    tokio::task::spawn({
        let handler_ctx = data_handler_ctx.clone();
        async move {
            handlers::search::subscribe_to_search_requests(&handler_ctx).await.map_err(to_datafusion_error)?;

            Ok::<(), datafusion::error::DataFusionError>(())
        }
    });

    tokio::task::spawn({
        let handler_ctx = data_handler_ctx.clone();
        async move {
            handlers::search::subscribe_to_generation_requests(handler_ctx).await.map_err(to_datafusion_error)?;

            Ok::<(), datafusion::error::DataFusionError>(())
        }
    });

    tokio::task::spawn({
        let handler_ctx = base_handler_ctx.clone();
        async move {
            handlers::ping::subscribe_to_ping_requests(&handler_ctx).await.map_err(to_datafusion_error)?;

            Ok::<(), datafusion::error::DataFusionError>(())
        }
    });

    Ok::<(), datafusion::error::DataFusionError>(())
}

async fn start_web_server(prometheus_counters: &contexts::PrometheusCounters) -> std::io::Result<()> {

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
        .unwrap_or("7830".to_string())
        .parse()
        .unwrap();

    HttpServer::new(move || {
        App::new()
            .wrap(prometheus.clone())
            .service(handlers::ping::ping)
    })
    .bind(("127.0.0.1", port))?
    .run()
    .await
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