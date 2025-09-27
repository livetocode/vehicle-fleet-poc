#![allow(non_snake_case)]
use async_nats::HeaderMap;
use chrono::{Utc, prelude::*};
use datafusion::arrow::array::{Array, Float64Array, StringViewArray, TimestampMillisecondArray};
use datafusion::arrow::datatypes::DataType;
use datafusion::datasource::file_format::arrow::ArrowFormat;
use datafusion::datasource::file_format::csv::CsvFormat;
use datafusion::datasource::file_format::json::JsonFormat;
use datafusion::datasource::file_format::parquet::ParquetFormat;
use datafusion::datasource::listing::{
    ListingOptions, ListingTable, ListingTableConfig, ListingTableUrl,
};
use datafusion::prelude::*;
use futures_util::StreamExt;
use geo::{Contains, Geometry, point};
use log;
use object_store::ObjectStore;
use object_store::azure::MicrosoftAzureBuilder;
use prost::Message;
use std::collections::{HashMap, HashSet};
use std::env;
use std::path::PathBuf;
use std::string::ToString;
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

const USE_PROTO_BUF: bool = true;

async fn execute_vehicle_query(
    ctx: &crate::contexts::DataHandlerContext,
    req: &crate::types::Request<crate::types::VehicleQueryRequest>,
) -> anyhow::Result<crate::types::VehicleQueryResponse> {
    let labels: std::collections::HashMap<&str, &str> = std::collections::HashMap::new();
    let query = &req.body;
    let query_timeout = match query.timeout {
        Some(timeout) => timeout,
        None => ctx.config.finder.defaultTimeoutInMS,
    };
    let (fromDate1, _) =
        crate::utils::time::round_datetime_modulo_minutes(query.fromDate.parse()?, 10);
    let (_, toDate2) = crate::utils::time::round_datetime_modulo_minutes(query.toDate.parse()?, 10);

    let fromDate = fromDate1.format("%Y-%m-%d-%H-%M").to_string();
    let toDate = toDate2.format("%Y-%m-%d-%H-%M").to_string();
    assert!(fromDate < toDate, "fromDate must be before toDate");
    let limit: usize = query.limit.unwrap_or(100).try_into()?;

    let geom: Geometry = (&query.geometry).try_into()?;
    let geohash_set = crate::utils::geo::geohash_covering(&geom, 5);
    let partitions: Vec<Expr> = geohash_set.iter().map(|h| lit(h)).collect();
    log::debug!("Partitions: {:?}", partitions);

    // execute_query(ctx, "SELECT * FROM events where \"vehicleType\" = 'Mini_van' and pk in ('f25kv', 'f25s0') and start >= '2024-01-01-06-50' and start < '2024-01-01-07-10' limit 10").await?;
    // execute_query(&ctx, "SELECT * FROM events limit 1000").await?;
    // ORDER BY
    //     period, partition

    let mut df = ctx.get_session().table("events").await?;

    df = df.filter(col("start").gt_eq(lit(fromDate)))?;
    df = df.filter(col("start").lt(lit(toDate)))?;
    df = df.filter(col("pk").in_list(partitions, false))?;
    if !query.vehicleTypes.is_empty() {
        let vehicle_types = query
            .vehicleTypes
            .iter()
            .map(|v| lit(v))
            .collect::<Vec<Expr>>();

        df = df.filter(col(r#""vehicleType""#).in_list(vehicle_types, false))?;
    }

    let schema = df.schema();

    let idxTimestamp = schema.index_of_column(&Column::from_qualified_name("timestamp"))?;
    let idxLat = schema.index_of_column(&Column::from_qualified_name("gps_lat"))?;
    let idxLon = schema.index_of_column(&Column::from_qualified_name("gps_lon"))?;
    let idxAlt = schema.index_of_column(&Column::from_qualified_name("gps_alt"))?;
    let idxVehicleId = schema.index_of_column(&Column::from_qualified_name(r#""vehicleId""#))?;
    let idxVehicleType =
        schema.index_of_column(&Column::from_qualified_name(r#""vehicleType""#))?;
    let idxDirection = schema.index_of_column(&Column::from_qualified_name("direction"))?;
    let idxSpeed = schema.index_of_column(&Column::from_qualified_name("speed"))?;
    let idxGeoHash = schema.index_of_column(&Column::from_qualified_name(r#""geoHash""#))?;

    let start_time = Instant::now();
    let mut processed_row_count: usize = 0;
    let mut selected_row_count: usize = 0;
    let mut batch_count: usize = 0;
    let mut total_bytes: usize = 0;
    let mut limitReached = false;
    let mut hasTimmedout = false;
    let mut vehicleIds = HashSet::new();

    let mut stream = df.execute_stream().await?;
    while let Some(batch_result) = stream.next().await {
        let batch = batch_result?;
        batch_count += 1;
        processed_row_count += batch.num_rows();
        total_bytes += batch.get_array_memory_size();

        let colTimestamp = batch
            .column(idxTimestamp)
            .as_any()
            .downcast_ref::<TimestampMillisecondArray>()
            .unwrap();
        let colLat = batch
            .column(idxLat)
            .as_any()
            .downcast_ref::<Float64Array>()
            .unwrap();
        let colLon = batch
            .column(idxLon)
            .as_any()
            .downcast_ref::<Float64Array>()
            .unwrap();
        let colAlt = batch
            .column(idxAlt)
            .as_any()
            .downcast_ref::<Float64Array>()
            .unwrap();
        let colVehicleId = batch
            .column(idxVehicleId)
            .as_any()
            .downcast_ref::<StringViewArray>()
            .unwrap();
        let colVehicleType = batch
            .column(idxVehicleType)
            .as_any()
            .downcast_ref::<StringViewArray>()
            .unwrap();
        let colDirection = batch
            .column(idxDirection)
            .as_any()
            .downcast_ref::<StringViewArray>()
            .unwrap();
        let colSpeed = batch
            .column(idxSpeed)
            .as_any()
            .downcast_ref::<Float64Array>()
            .unwrap();
        let colGeoHash = batch
            .column(idxGeoHash)
            .as_any()
            .downcast_ref::<StringViewArray>()
            .unwrap();

        for i in 0..batch.num_rows() {
            let vehicle_timestamp = colTimestamp.value(i);
            let vehicle_lat = colLat.value(i);
            let vehicle_lon = colLon.value(i);
            let vehicle_alt = colAlt.value(i);
            let vehicle_id = colVehicleId.value(i);
            let vehicle_type = colVehicleType.value(i);
            let direction = colDirection.value(i);
            let speed = colSpeed.value(i);
            let geo_hash = colGeoHash.value(i);
            if vehicle_lat.is_nan() || vehicle_lon.is_nan() || vehicle_alt.is_nan() {
                continue;
            }
            let datetime = Utc
                .timestamp_millis_opt(vehicle_timestamp)
                .single()
                .unwrap();
            if (datetime < fromDate1) || (datetime >= toDate2) {
                continue;
            }

            let p = point!(x: vehicle_lon, y: vehicle_lat);
            if !geom.contains(&p) {
                continue;
            }
            selected_row_count += 1;
            vehicleIds.insert(vehicle_id.to_string());
            ctx.parent
                .prometheus_counters
                .vehicles_search_processed_events_total_counter
                .with(&labels)
                .inc();

            if USE_PROTO_BUF {
                let gps = crate::types_proto::GpsCoordinates {
                    lat: vehicle_lat,
                    lon: vehicle_lon,
                    alt: 0.0,
                };
                let result = crate::types_proto::VehicleQueryResult {
                    query_id: query.id.clone(),
                    timestamp: datetime.to_rfc3339(),
                    vehicle_id: vehicle_id.to_string(),
                    vehicle_type: vehicle_type.to_string(),
                    gps: Some(gps),
                    direction: direction.to_string(),
                    speed,
                    geo_hash: geo_hash.to_string(),
                };
                let mut buf = Vec::new();
                result.encode(&mut buf)?;
                let mut headers = HeaderMap::new();
                headers.insert("proto/type", "vehicle-query-result");
                ctx.parent
                    .nats_client
                    .publish_with_headers(req.replyTo.clone(), headers, buf.into())
                    .await?;
            } else {
                let gps = crate::types::GpsCoordinates {
                    lat: vehicle_lat,
                    lon: vehicle_lon,
                    alt: 0.0,
                };
                let result = crate::types::VehicleQueryResult {
                    msg_type: "vehicle-query-result".to_string(),
                    queryId: query.id.clone(),
                    timestamp: datetime.to_rfc3339(),
                    vehicleId: vehicle_id.to_string(),
                    vehicleType: vehicle_type.to_string(),
                    gps,
                    direction: direction.to_string(),
                    speed,
                    geoHash: geo_hash.to_string(),
                };
                let result_json = serde_json::to_vec(&result)?;
                ctx.parent
                    .nats_client
                    .publish(req.replyTo.clone(), result_json.into())
                    .await?;
            }
        }
        if selected_row_count >= limit {
            limitReached = true;
            break;
        }
        if start_time.elapsed().as_millis() >= query_timeout {
            hasTimmedout = true;
        }
        if limitReached || hasTimmedout {
            break;
        }
    }
    let duration = start_time.elapsed();
    log::info!("Total rows processed: {}", processed_row_count);
    log::info!("Total rows selected: {}", selected_row_count);

    let respBody = crate::types::VehicleQueryResponse {
        msg_type: "vehicle-query-response".to_string(),
        processedFilesCount: batch_count,
        processedBytes: total_bytes,
        processedRecordCount: processed_row_count,
        selectedRecordCount: selected_row_count,
        distinctVehicleCount: vehicleIds.len(),
        elapsedTimeInMS: duration.as_millis(),
        timeoutExpired: false,
        limitReached: limitReached,
    };

    Ok(respBody)
}

async fn process_search_request(
    ctx: crate::contexts::DataHandlerContext,
    req: crate::types::Request<crate::types::VehicleQueryRequest>,
) -> anyhow::Result<()> {
    log::info!("Received NATS request: {:?}", req);

    let start = crate::types::VehicleQueryStartedEvent {
        msg_type: "vehicle-query-started".to_string(),
        query: req.clone(),
    };
    let msg_json = serde_json::to_vec(&start)?;
    ctx.parent
        .nats_client
        .publish("events.vehicles.query.started", msg_json.into())
        .await?;

    let resp: crate::types::Response<crate::types::VehicleQueryResponse> =
        match execute_vehicle_query(&ctx, &req).await {
            Ok(respBody) => {
                log::info!("Vehicle query executed successfully");
                crate::types::Response::Success {
                    id: Uuid::new_v4().to_string(),
                    requestId: req.id.clone(),
                    body: respBody,
                }
            }
            Err(e) => {
                log::error!("Error executing vehicle query: {}", e);
                crate::types::Response::Error {
                    id: Uuid::new_v4().to_string(),
                    requestId: req.id.clone(),
                    code: crate::types::ResponseErrorCode::Exception,
                    body: None,
                    error: Some(e.to_string()),
                }
            }
        };

    let resp_json = serde_json::to_vec(&resp)?;
    log::info!("Sending NATS response: {:?}", resp);
    ctx.parent
        .nats_client
        .publish(req.replyTo.clone(), resp_json.into())
        .await?;

    let stop = match resp {
        crate::types::Response::Success { body, .. } => crate::types::VehicleQueryStoppedEvent {
            msg_type: "vehicle-query-stopped".to_string(),
            query: req.clone(),
            isSuccess: true,
            response: Some(body),
            error: None,
        },
        crate::types::Response::Error { error, .. } => crate::types::VehicleQueryStoppedEvent {
            msg_type: "vehicle-query-stopped".to_string(),
            query: req.clone(),
            isSuccess: false,
            response: None,
            error,
        },
    };
    let msg_json = serde_json::to_vec(&stop)?;
    ctx.parent
        .nats_client
        .publish("events.vehicles.query.stopped", msg_json.into())
        .await?;
    Ok(())
}

pub fn subscribe_to_search_requests(
    ctx: crate::contexts::DataHandlerContext,
) -> anyhow::Result<()> {
    let _ = crate::utils::messaging::message_loop(
        ctx,
        "requests.vehicles.query".to_string(),
        process_search_request,
    );
    anyhow::Ok(())
}

pub fn subscribe_to_generation_requests(
    ctx: crate::contexts::DataHandlerContext,
) -> anyhow::Result<()> {
    let _ = crate::utils::messaging::message_loop(
        ctx,
        "events.vehicles.generation.stopped".to_string(),
        process_generation_requests,
    );
    anyhow::Ok(())
}

pub async fn process_generation_requests(
    mut ctx: crate::contexts::DataHandlerContext,
    _req: crate::types::VehicleGenerationStopped,
) -> anyhow::Result<()> {
    let session = create_session_context(&ctx.config).await?;
    ctx.set_session(session);
    log::warn!("Created a brand new session context after the new generation completed.");
    anyhow::Ok(())
}

pub async fn create_session_context(
    config: &Arc<crate::config::Config>,
) -> anyhow::Result<SessionContext> {
    let prefix = url::Url::parse("events:///").unwrap();
    let (format, store) = build_object_store(config)?;

    let ctx = SessionContext::new();
    let session_state = ctx.state();
    ctx.register_object_store(&prefix, store);

    log::info!("Using prefix: {}", prefix);
    let table_path = ListingTableUrl::parse(prefix)?;

    let (listing_options, file_ext) = match format.as_str() {
        "arrow" => (
            ListingOptions::new(Arc::new(ArrowFormat::default())),
            ".arrow",
        ),
        "csv" => (ListingOptions::new(Arc::new(CsvFormat::default())), ".csv"),
        "json" => (
            ListingOptions::new(Arc::new(JsonFormat::default())),
            ".json",
        ),
        "parquet" => (
            ListingOptions::new(Arc::new(ParquetFormat::default())),
            ".parquet",
        ),
        _ => anyhow::bail!("Unknown file format '{}'", format),
    };
    let listing_options = listing_options
        .with_file_extension(file_ext)
        .with_table_partition_cols(vec![
            ("y".to_string(), DataType::Utf8),
            ("m".to_string(), DataType::Utf8),
            ("d".to_string(), DataType::Utf8),
            ("hh".to_string(), DataType::Utf8),
            ("mm".to_string(), DataType::Utf8),
            ("start".to_string(), DataType::Utf8),
            ("int".to_string(), DataType::Utf8),
            ("pk".to_string(), DataType::Utf8),
        ]);

    let resolved_schema = listing_options
        .infer_schema(&session_state, &table_path)
        .await?;
    let config = ListingTableConfig::new(table_path)
        .with_listing_options(listing_options)
        .with_schema(resolved_schema);

    let provider = Arc::new(ListingTable::try_new(config)?);
    ctx.register_table("events", provider)?;

    Ok(ctx)
}

pub fn build_object_store(
    config: &Arc<crate::config::Config>,
) -> anyhow::Result<(String, Arc<dyn ObjectStore>)> {
    if config.collector.output.flatLayout {
        return Err(anyhow::format_err!(
            "This finder cannot use the flat layout, because it needs the key/value tags to help filtering the data"
        ));
    }
    let default_format = "parquet".to_string();
    let format = config
        .collector
        .output
        .formats
        .get(0)
        .unwrap_or(&default_format);

    match &config.collector.output.storage {
        crate::config::StorageConfig::FileStorageConfig { folder } => {
            let mut data_folder = build_data_folder_path(&folder, "DATA_FOLDER")?;
            data_folder = data_folder.join(format);

            log::info!("Using data folder: {}", data_folder.display());

            let local_store = object_store::local::LocalFileSystem::new_with_prefix(data_folder)?;
            Ok((format.clone(), Arc::new(local_store)))
        }
        crate::config::StorageConfig::AzureBlobStorageConfig {
            accountName,
            containerName,
            connectionString,
        } => {
            let connectionString = match env::var("VEHICLES_AZURE_STORAGE_CONNECTION_STRING") {
                Ok(cs) => cs.clone(),
                _ => match connectionString {
                    Some(s) => s.clone(),
                    None => {
                        anyhow::bail!("exected to find connectionString in AzureBlobStorageConfig")
                    }
                },
            };
            let parts = parse_key_value_string(connectionString.as_str())?;
            let sas = parts
                .get("SharedAccessSignature")
                .expect("expected to find SharedAccessSignature in the connectionString");
            let account_name = accountName.clone();
            log::info!(
                "Using Azure storage account: name={}, container={}",
                account_name,
                containerName
            );
            let azure_store = MicrosoftAzureBuilder::new()
                .with_account(account_name)
                .with_container_name(containerName)
                .with_config(object_store::azure::AzureConfigKey::SasKey, sas)
                .build()?;
            Ok((format.clone(), Arc::new(azure_store)))
        }
        _ => anyhow::bail!("Unexpected storage config {:?}", config),
    }
}

pub fn build_data_folder_path(folder: &String, env_var_name: &str) -> anyhow::Result<PathBuf> {
    let data_folder = match env::var(env_var_name) {
        Ok(s) => PathBuf::from(s),
        Err(_) => {
            let mut data_folder = PathBuf::from(folder);
            if !data_folder.is_absolute() {
                let current_dir = std::env::current_dir()?;
                log::debug!("Current dir: {}", current_dir.display());
                let mut default_data_dir = current_dir.join(&data_folder);
                if default_data_dir.exists() {
                    default_data_dir = default_data_dir
                        .canonicalize()
                        .expect("Failed to canonicalize default data dir");
                }
                data_folder = default_data_dir;
            }
            data_folder
        }
    };
    Ok(data_folder)
}

pub fn parse_key_value_string(input: &str) -> anyhow::Result<HashMap<String, String>> {
    let mut map = HashMap::new();

    for pair in input.split(';') {
        if pair.is_empty() {
            continue;
        }

        if let Some((key, value)) = pair.split_once('=') {
            map.insert(key.trim().to_string(), value.trim().to_string());
        } else {
            return Err(anyhow::format_err!(
                "Invalid key-value pair format: '{}' (missing '=')",
                pair
            ));
        }
    }

    Ok(map)
}
