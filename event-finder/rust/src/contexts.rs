use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct PrometheusCounters {
    pub prometheus_registry: prometheus::Registry,
    pub vehicles_search_processed_events_total_counter: prometheus::IntCounterVec,
}

pub trait HasNatsClient: Clone {
    fn get_nats_client(&self) -> &async_nats::Client;
}

#[derive(Clone)]
pub struct HandlerContext {
    pub nats_client: async_nats::Client,
    pub prometheus_counters: PrometheusCounters,
    pub identity: crate::types::ServiceIdentity,
}

impl HasNatsClient for HandlerContext {
    fn get_nats_client(&self) -> &async_nats::Client {
        &self.nats_client
    }
}

#[derive(Clone)]
pub struct DataHandlerContext {
    pub parent: HandlerContext,
    pub config: Arc<crate::config::Config>,
    session: Arc<Mutex<datafusion::execution::context::SessionContext>>,
}

impl DataHandlerContext {
    pub fn new(
        parent: HandlerContext,
        config: Arc<crate::config::Config>,
        session: datafusion::execution::context::SessionContext,
    ) -> Self {
        Self {
            parent,
            config,
            session: Arc::new(Mutex::new(session)),
        }
    }

    pub fn get_session(&self) -> datafusion::execution::context::SessionContext {
        let guard = (*self.session).lock().unwrap();
        guard.clone()
    }

    pub fn set_session(&mut self, session: datafusion::execution::context::SessionContext) {
        let mut guard = (*self.session).lock().unwrap();
        *guard = session;
    }
}

impl HasNatsClient for DataHandlerContext {
    fn get_nats_client(&self) -> &async_nats::Client {
        &self.parent.get_nats_client()
    }
}
