use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Note {
	pub id: Uuid,
    pub title: String,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateNote {
	pub title: String,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct NoteExport {
	pub id: Uuid,
    pub title: String,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
	pub state_vector: Option<Vec<u8>>,
}