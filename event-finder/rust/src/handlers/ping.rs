use actix_web::{HttpResponse, Responder, get};
use futures_util::StreamExt;
use uuid::Uuid;

pub async fn subscribe_to_ping_requests(
    ctx: &crate::contexts::HandlerContext,
) -> anyhow::Result<()> {
    let mut sub = ctx
        .nats_client
        .subscribe("messaging.control".to_string())
        .await?;
    while let Some(msg) = sub.next().await {
        let res: anyhow::Result<()> = match serde_json::from_slice::<
            crate::types::Request<crate::types::PingRequest>,
        >(&msg.payload)
        {
            Ok(req) => process_ping_request(&ctx, &req).await,
            Err(e) => Err(anyhow::anyhow!(
                "Could not deserialize message as JSON: {}",
                e
            )),
        };
        if let Err(e) = res {
            eprintln!("Error processing NATS request: {}", e);
        }
    }
    anyhow::Ok(())
}

async fn process_ping_request(
    ctx: &crate::contexts::HandlerContext,
    req: &crate::types::Request<crate::types::PingRequest>,
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
    println!("Sending NATS response: {:?}", resp);
    ctx.nats_client
        .publish(req.replyTo.clone(), resp_json.into())
        .await?;
    anyhow::Ok(())
}

#[get("/ping")]
pub async fn ping() -> impl Responder {
    HttpResponse::Ok().body("pong")
}
