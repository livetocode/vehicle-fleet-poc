use serde::{Deserialize, Serialize};

pub trait HasMessageType: for<'de> Deserialize<'de> + Serialize + Clone + 'static {
    fn get_msg_type(&self) -> &str;
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VehicleQueryRequest {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub id: String,
    pub from_date: String,
    pub to_date: String,
    pub geometry: geojson::Geometry,
    pub vehicle_types: Vec<String>,
    pub limit: Option<u64>,
    pub timeout: Option<u128>,
    pub ttl: Option<String>,
    pub parallelize: Option<bool>,
    pub use_chunking: Option<bool>,
}

impl HasMessageType for VehicleQueryRequest {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VehicleQueryResponse {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub processed_files_count: usize,
    pub processed_bytes: usize,
    pub processed_record_count: usize,
    pub selected_record_count: usize,
    pub distinct_vehicle_count: usize,
    pub elapsed_time_in_MS: u128,
    pub timeout_expired: bool,
    pub limit_reached: bool,
}

impl HasMessageType for VehicleQueryResponse {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TypedMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
}

impl HasMessageType for TypedMessage {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[serde(bound(deserialize = "TBody: HasMessageType"))]
pub struct Request<TBody>
where
    TBody: HasMessageType,
{
    pub id: String,
    #[serde(rename = "type")]
    pub msg_type: String, // devrait valoir "request"
    pub reply_to: String,
    pub parent_id: Option<String>,
    pub expires_at: Option<String>,
    pub timeout: Option<u64>,
    pub body: TBody,
}

impl<TBody: HasMessageType> HasMessageType for Request<TBody> {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResponseSuccess<TBody = TypedMessage> {
    pub id: String,
    pub request_id: String,
    #[serde(rename = "type")]
    pub msg_type: String, // devrait valoir "response-success"
    pub body: TBody,
}

impl<TBody: HasMessageType> HasMessageType for ResponseSuccess<TBody> {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResponseError {
    pub id: String,
    pub request_id: String,
    #[serde(rename = "type")]
    pub msg_type: String, // devrait valoir "response-error"
    pub code: String, // 'expired' | 'timeout' | 'cancelled' | 'exception'
    pub body: Option<serde_json::Value>,
    pub error: Option<String>,
}

impl HasMessageType for ResponseError {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum Response<TBody = TypedMessage> {
    #[serde(rename = "response-success")]
    Success {
        id: String,
        #[serde(rename = "requestId")]
        request_id: String,
        body: TBody,
    },
    #[serde(rename = "response-error")]
    Error {
        id: String,
        #[serde(rename = "requestId")]
        request_id: String,
        code: ResponseErrorCode,
        body: Option<serde_json::Value>,
        error: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ResponseErrorCode {
    Expired,
    Timeout,
    Cancelled,
    Exception,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpsCoordinates {
    pub lat: f64,
    pub lon: f64,
    pub alt: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VehicleQueryResult {
    #[serde(rename = "type")]
    pub msg_type: String, // "vehicle-query-result"
    pub query_id: String,
    pub timestamp: String,
    pub vehicle_id: String,
    pub vehicle_type: String,
    pub gps: GpsCoordinates,
    pub direction: String,
    pub speed: f64,
    pub geo_hash: String,
}

impl HasMessageType for VehicleQueryResult {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VehicleQueryStartedEvent {
    #[serde(rename = "type")]
    pub msg_type: String, // "vehicle-query-started"
    pub query: Request<VehicleQueryRequest>,
}

impl HasMessageType for VehicleQueryStartedEvent {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VehicleQueryStoppedEvent {
    #[serde(rename = "type")]
    pub msg_type: String, // "vehicle-query-stopped"
    pub query: Request<VehicleQueryRequest>,
    pub is_success: bool,
    pub response: Option<VehicleQueryResponse>,
    pub error: Option<String>,
}

impl HasMessageType for VehicleQueryStoppedEvent {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServiceIdentity {
    pub name: String,
    pub instance: usize,
    pub runtime: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PingRequest {
    #[serde(rename = "type")]
    pub msg_type: String, // "ping"
    pub service_name: Option<String>,
}

impl HasMessageType for PingRequest {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PingResponse {
    #[serde(rename = "type")]
    pub msg_type: String, // "pong"
    pub identity: ServiceIdentity,
}

impl HasMessageType for PingResponse {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VehicleGenerationStopped {
    #[serde(rename = "type")]
    pub msg_type: String, // "vehicle-generation-stopped"
    pub success: bool,
    pub timestamp: String,
    pub elapsed_time_in_MS: f64,
}

impl HasMessageType for VehicleGenerationStopped {
    fn get_msg_type(&self) -> &str {
        &self.msg_type
    }
}
