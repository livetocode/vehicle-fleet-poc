#![allow(non_snake_case, )]
use std::env;
use std::path::PathBuf;
use async_nats::HeaderMap;
use datafusion::arrow::array::{
    Array, Float64Array, StringViewArray, TimestampMillisecondArray,
};
use datafusion::arrow::datatypes::{DataType};
use datafusion::datasource::file_format::parquet::ParquetFormat;
use datafusion::datasource::listing::{
    ListingOptions, ListingTable, ListingTableConfig, ListingTableUrl,
};
use datafusion::prelude::*;
use chrono::{prelude::*, Utc};
use futures_util::StreamExt;
use geo::{ Geometry, Contains, point };
use std::collections::HashSet;
use std::string::ToString;
use std::sync::Arc;
use std::time::Instant; 
use uuid::Uuid;
use prost::Message;
use crate::utils::errors::{to_string_error, to_datafusion_error };

const USE_PROTO_BUF: bool = true;


async fn execute_vehicle_query(ctx: &crate::contexts::DataHandlerContext, req: &crate::types::Request<crate::types::VehicleQueryRequest>) -> datafusion::error::Result<crate::types::VehicleQueryResponse> {
    let labels: std::collections::HashMap<&str, &str> = std::collections::HashMap::new();
    let query = &req.body;
    let (fromDate1, _) = crate::utils::time::round_datetime_modulo_minutes(query.fromDate.parse().unwrap(), 10);
    let (_, toDate2) = crate::utils::time::round_datetime_modulo_minutes(query.toDate.parse().unwrap(), 10);

    let fromDate = fromDate1.format("%Y-%m-%d-%H-%M").to_string();
    let toDate = toDate2.format("%Y-%m-%d-%H-%M").to_string();
    assert!(fromDate < toDate, "fromDate must be before toDate");
    let limit: usize = query.limit.unwrap_or(100).try_into().unwrap();
    
    let geom: Geometry = (&query.geometry).try_into().unwrap();
    let geohash_set = crate::utils::geo::geohash_covering(&geom, 5);
    let partitions: Vec<Expr> = geohash_set.iter().map(|h| lit(h)).collect();
    println!("Partitions: {:?}", partitions);

    // execute_query(ctx, "SELECT * FROM events where \"vehicleType\" = 'Mini_van' and partition in ('f25kv', 'f25s0') and period >= '2024-01-01-06-50' and period < '2024-01-01-07-10' limit 10").await?;
    // execute_query(&ctx, "SELECT * FROM events limit 1000").await?;
    // ORDER BY
    //     period, partition

    let mut df = ctx.get_session().table("events").await?;

    df = df.filter(col("start").gt_eq(lit(fromDate)))?;
    df = df.filter(col("start").lt(lit(toDate)))?;
    df = df.filter(col("pk").in_list(partitions, false))?;
    if !query.vehicleTypes.is_empty() {
        let vehicle_types = query.vehicleTypes.iter()
            .map(|v| lit(v))
            .collect::<Vec<Expr>>();

        df = df.filter(col(r#""vehicleType""#).in_list(vehicle_types, false))?;
    }

    let schema = df.schema();
    // println!("Schema: {:?}", schema);

    let idxTimestamp = schema.index_of_column(&Column::from_qualified_name("timestamp")).unwrap();
    let idxLat = schema.index_of_column(&Column::from_qualified_name("gps_lat")).unwrap();
    let idxLon = schema.index_of_column(&Column::from_qualified_name("gps_lon")).unwrap();
    let idxAlt = schema.index_of_column(&Column::from_qualified_name("gps_alt")).unwrap();
    let idxVehicleId = schema.index_of_column(&Column::from_qualified_name(r#""vehicleId""#)).unwrap();
    let idxVehicleType = schema.index_of_column(&Column::from_qualified_name(r#""vehicleType""#)).unwrap();
    let idxDirection = schema.index_of_column(&Column::from_qualified_name("direction")).unwrap();
    let idxSpeed = schema.index_of_column(&Column::from_qualified_name("speed")).unwrap();
    let idxGeoHash = schema.index_of_column(&Column::from_qualified_name(r#""geoHash""#)).unwrap();

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

        let colTimestamp = batch.column(idxTimestamp).as_any().downcast_ref::<TimestampMillisecondArray>().unwrap();
        let colLat = batch.column(idxLat).as_any().downcast_ref::<Float64Array>().unwrap();
        let colLon = batch.column(idxLon).as_any().downcast_ref::<Float64Array>().unwrap();
        let colAlt = batch.column(idxAlt).as_any().downcast_ref::<Float64Array>().unwrap();
        let colVehicleId = batch.column(idxVehicleId).as_any().downcast_ref::<StringViewArray>().unwrap();
        let colVehicleType = batch.column(idxVehicleType).as_any().downcast_ref::<StringViewArray>().unwrap();
        let colDirection = batch.column(idxDirection).as_any().downcast_ref::<StringViewArray>().unwrap();
        let colSpeed = batch.column(idxSpeed).as_any().downcast_ref::<Float64Array>().unwrap();
        let colGeoHash = batch.column(idxGeoHash).as_any().downcast_ref::<StringViewArray>().unwrap();
        
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
            let datetime = Utc.timestamp_millis_opt(vehicle_timestamp).single().unwrap();
            if (datetime < fromDate1) || (datetime >= toDate2) {
                continue;
            }

            let p = point!(x: vehicle_lon, y: vehicle_lat);
            if geom.contains(&p) {
                selected_row_count += 1;
                vehicleIds.insert(vehicle_id.to_string());
                ctx.parent.prometheus_counters.vehicles_search_processed_events_total_counter.with(&labels).inc();

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
                    result.encode(&mut buf).unwrap();
                    let mut headers = HeaderMap::new();
                    headers.insert("proto/type", "vehicle-query-result");
                    ctx.parent.nats_client.publish_with_headers(req.replyTo.clone(), headers, buf.into()).await.unwrap();
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
                    let result_json = serde_json::to_vec(&result).map_err(to_datafusion_error)?;
                    ctx.parent.nats_client.publish(req.replyTo.clone(), result_json.into()).await.unwrap();
                }
            }
            if selected_row_count >= limit {
                limitReached = true;
                break;
            }
        }
        if let Some(timeout) = query.timeout {
            if start_time.elapsed().as_millis() >= timeout {
                hasTimmedout = true;
            }
        }
        if limitReached || hasTimmedout{
            break;
        }
    }
    let duration = start_time.elapsed();
    println!("Total rows processed: {}", processed_row_count);
    println!("Total rows selected: {}", selected_row_count);

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

async fn process_search_request(ctx: &crate::contexts::DataHandlerContext, req: &crate::types::Request<crate::types::VehicleQueryRequest>) -> datafusion::error::Result<()> {
    println!("Received NATS request: {:?}", req);

    let start = crate::types::VehicleQueryStartedEvent {
        msg_type: "vehicle-query-started".to_string(),
        query: req.clone(),
    };
    let msg_json = serde_json::to_vec(&start).map_err(to_datafusion_error)?;
    ctx.parent.nats_client.publish("events.vehicles.query.started", msg_json.into()).await.map_err(to_datafusion_error)?;

    let resp: crate::types::Response<crate::types::VehicleQueryResponse> = match execute_vehicle_query(&ctx, &req).await {
        Ok(respBody) => {
            println!("Vehicle query executed successfully");
            crate::types::Response::Success {
                id: Uuid::new_v4().to_string(),
                requestId: req.id.clone(),
                body: respBody,
            }
        }
        Err(e) => {
            eprintln!("Error executing vehicle query: {}", e);
            crate::types::Response::Error {
                id: Uuid::new_v4().to_string(),
                requestId: req.id.clone(),
                code: crate::types::ResponseErrorCode::Exception,
                body: None,
                error: Some(e.to_string()),
            }
        }
    };
    
    let resp_json = serde_json::to_vec(&resp).map_err(to_datafusion_error)?;
    println!("Sending NATS response: {:?}", resp);
    ctx.parent.nats_client.publish(req.replyTo.clone(), resp_json.into()).await.map_err(to_datafusion_error)?;

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
    let msg_json = serde_json::to_vec(&stop).map_err(to_datafusion_error)?;
    ctx.parent.nats_client.publish("events.vehicles.query.stopped", msg_json.into()).await.map_err(to_datafusion_error)?;
    Ok(())
}

pub async fn subscribe_to_search_requests(ctx: &crate::contexts::DataHandlerContext) -> Result<(), String> {
    let mut sub = ctx.parent.nats_client.subscribe("requests.vehicles.query".to_string()).await.map_err(to_string_error)?;
    while let Some(msg) = sub.next().await {
        let res = match serde_json::from_slice::<crate::types::Request<crate::types::VehicleQueryRequest>>(&msg.payload) {
            Ok(req) => {
                process_search_request(&ctx, &req).await
            }
            Err(e) => {
                Err(datafusion::error::DataFusionError::Internal(e.to_string()))
            }
        };
        if let Err(e) = res {
            eprintln!("Error processing NATS request: {}", e);
        }
    }
    Ok(())
}

pub async fn subscribe_to_generation_requests(mut ctx: crate::contexts::DataHandlerContext) -> Result<(), String> {
    let mut sub = ctx.parent.nats_client.subscribe("events.vehicles.generation.stopped".to_string()).await.map_err(to_string_error)?;
    while let Some(msg) = sub.next().await {
        let res = match serde_json::from_slice::<crate::types::VehicleGenerationStopped>(&msg.payload) {
            Ok(msg) => {
                println!("Received NATS message: {:?}", msg);
                let session = create_session_context().await.map_err(to_string_error)?;
                ctx.set_session(session);
                println!("Created a brand new session context after the new generation completed.");
                Ok(())
            }
            Err(e) => {
                eprintln!("Error deserializing NATS message: {}", e);
                Err(datafusion::error::DataFusionError::Internal(e.to_string()))
            }
        };
        if let Err(e) = res {
            eprintln!("Error processing NATS request: {}", e);
        }
    }
    Ok(())
}

pub async fn create_session_context() -> datafusion::error::Result::<SessionContext> {
    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("./"));
    println!("Current dir: {}", current_dir.display());
    let mut default_data_dir = current_dir.join("../../output/data/parquet/");
    if default_data_dir.exists() {
        default_data_dir = default_data_dir.canonicalize().expect("Failed to canonicalize default data dir");
    }
    let data_folder = env::var("DATA_FOLDER").unwrap_or(default_data_dir.display().to_string());
    // println!("Using data folder: {}", data_folder);
    let mut data_folder = url::Url::from_file_path(  PathBuf::from(data_folder))
        .map_err(|_| datafusion::error::DataFusionError::Internal("Failed to convert data folder path to URL".to_string()))?
        .to_string();
    if !data_folder.ends_with('/') {
        data_folder.push_str("/");
    }
    println!("Using data folder: {}", data_folder);
    let table_path =
        ListingTableUrl::parse(data_folder)?;

    let ctx = SessionContext::new();
    let session_state = ctx.state();

    let file_format = ParquetFormat::new();
    let listing_options = ListingOptions::new(Arc::new(file_format))
        .with_file_extension(".parquet")
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

    let resolved_schema = listing_options.infer_schema(&session_state, &table_path).await?;
    let config = ListingTableConfig::new(table_path)
        .with_listing_options(listing_options)
        .with_schema(resolved_schema);

    let provider = Arc::new(ListingTable::try_new(config)?);
    ctx.register_table("events", provider)?;

    Ok(ctx)
}
