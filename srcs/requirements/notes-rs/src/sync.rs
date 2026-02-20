use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc::UnboundedSender};
use uuid::Uuid;
use yrs::Doc;

pub struct DocumentRoom {
    pub doc: Arc<RwLock<Doc>>,
    pub clients: HashMap<u64, UnboundedSender<Vec<u8>>>,
    pub awareness_states: HashMap<u64, AwarenessState>,
}

#[derive(Clone)]
pub struct AwarenessState {
    pub clock: u64,
    pub state_json: String,
}

pub struct AppState {
    pub pool: PgPool,
    pub rooms: RwLock<HashMap<Uuid, Arc<RwLock<DocumentRoom>>>>,
}

impl AppState {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            rooms: RwLock::new(HashMap::new()),
        }
    }
}
