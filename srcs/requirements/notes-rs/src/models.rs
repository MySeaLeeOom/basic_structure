use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Note {
    pub id: Uuid,
    pub doc_state: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub title_preview: Option<String>,
    pub content_preview: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct NoteSummary {
    pub id: Uuid,
    pub title_preview: Option<String>,
    pub content_preview: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct NoteUpdate {
    pub id: i64,
    pub note_id: Uuid,
    pub update_data: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub client_id: Option<Uuid>,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct ClientSyncState {
    pub client_id: Uuid,
    pub note_id: Uuid,
    pub last_update_id: i64,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateNote {
    pub title: Option<String>,
    pub content: Option<String>,
    pub owner_id: Option<Uuid>,
}
