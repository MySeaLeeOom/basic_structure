use sqlx::PgPool;
use yrs::Doc;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use tokio::sync::{mpsc::UnboundedSender, RwLock};

pub struct DocumentRoom {
    pub doc: Arc<RwLock<Doc>>,
    pub clients: HashMap<u64, UnboundedSender<Vec<u8>>>,
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
