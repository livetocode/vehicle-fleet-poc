use actix_web::{HttpResponse, Responder, get};
use uuid::Uuid;
use log;

pub fn subscribe_to_ping_requests(ctx: crate::contexts::HandlerContext) -> anyhow::Result<()> {
    let _ = crate::utils::messaging::message_loop(
        ctx,
        "messaging.control".to_string(),
        process_ping_request,
    );
    anyhow::Ok(())
}

pub async fn process_ping_request(
    ctx: crate::contexts::HandlerContext,
    req: crate::types::Request<crate::types::PingRequest>,
) -> anyhow::Result<()> {
    let resp = crate::types::Response::<crate::types::PingResponse>::Success {
        id: Uuid::new_v4().to_string(),
        requestId: req.id.clone(),
        body: crate::types::PingResponse {
            msg_type: "pong".to_string(),
            identity: ctx.identity.clone(),
        },
    };
    let resp_json = serde_json::to_vec(&resp)?;
    log::info!("Sending NATS response: {:?}", resp);
    ctx.nats_client
        .publish(req.replyTo.clone(), resp_json.into())
        .await?;
    anyhow::Ok(())
}

#[get("/ping")]
pub async fn ping() -> impl Responder {
    HttpResponse::Ok().body("pong")
}
