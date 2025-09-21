use crate::contexts::HasNatsClient;
use futures_util::StreamExt;
use std::future::Future;
use tokio::task::JoinHandle;
use log;

pub fn message_loop<TContext, TMessage, F, Fut>(
    ctx: TContext,
    subject: String,
    handler: F,
) -> JoinHandle<anyhow::Result<()>>
where
    TContext: HasNatsClient + Clone + Send + Sync + 'static,
    TMessage: crate::types::HasMessageType + Send + Sync + 'static,
    F: Fn(TContext, TMessage) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = anyhow::Result<()>> + Send + 'static,
{
    tokio::task::spawn(async move {
        let nats_client = ctx.get_nats_client().clone();
        let mut sub = nats_client.subscribe(subject.clone()).await?;

        while let Some(msg) = sub.next().await {
            let res = match serde_json::from_slice::<TMessage>(&msg.payload) {
                Ok(req) => handler(ctx.clone(), req).await,
                Err(e) => Err(anyhow::anyhow!(
                    "Could not deserialize message as JSON: {}",
                    e
                )),
            };

            if let Err(e) = res {
                log::error!("Error processing NATS request: {}", e);
            }
        }
        anyhow::Ok(())
    })
}
