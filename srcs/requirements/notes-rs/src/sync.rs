use sqlx::PgPool;
use yrs::{Doc, Update};
use std::collections::HashMap;
use std::sync::{Arc};
use uuid::Uuid;
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::RwLock;

struct DocumentRoom {
    doc: Arc<RwLock<Doc>>,                          
    clients: HashMap<u64, UnboundedSender<Vec<u8>>>
}

struct AppState {
    pool: PgPool,
    rooms: RwLock<HashMap<Uuid, Arc<RwLock<DocumentRoom>>>>
}