use uuid::Uuid;
use futures_util::StreamExt;
use actix_web::{get, HttpResponse, Responder};
use crate::utils::errors::{to_string_error, to_datafusion_error };

pub async fn subscribe_to_ping_requests(ctx: &crate::contexts::HandlerContext) -> Result<(), String> {
    let mut sub = ctx.nats_client.subscribe("messaging.control".to_string()).await.map_err(to_string_error)?;
    while let Some(msg) = sub.next().await {
        let res = match serde_json::from_slice::<crate::types::Request<crate::types::PingRequest>>(&msg.payload) {
            Ok(req) => {
                process_ping_request(&ctx, &req).await
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

async fn process_ping_request(ctx: &crate::contexts::HandlerContext, req: &crate::types::Request<crate::types::PingRequest>) -> datafusion::error::Result<()>  {
    let resp = crate::types::Response::<crate::types::PingResponse>::Success {
        id: Uuid::new_v4().to_string(),
        requestId: req.id.clone(),
        body: crate::types::PingResponse {
            msg_type: "pong".to_string(),
            identity: ctx.identity.clone(),
        },
    };
    let resp_json = serde_json::to_vec(&resp).map_err(to_datafusion_error)?;
    println!("Sending NATS response: {:?}", resp);
    ctx.nats_client.publish(req.replyTo.clone(), resp_json.into()).await.map_err(to_datafusion_error)?;
    Ok(())
}


#[get("/ping")]
pub async fn ping() -> impl Responder {
    HttpResponse::Ok().body("pong")
}
