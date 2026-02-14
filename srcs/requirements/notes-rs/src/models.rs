use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Note {
	pub id: Uuid,
	pub doc_state: Vec<u8>,
	pub created_at: DateTime<Utc>,
	pub updated_at: DateTime<Utc>,
	pub title: String,
	pub content: String,
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
	pub doc_state: Vec<u8>,
	pub owner_id: Option<Uuid>,
	pub title: Option<String>,
	pub content: Option<String>,
}

#[derive(Deserialize)]
pub struct SubmitUpdate {
	pub note_id: Uuid,
	pub update_data: Vec<u8>,
	pub client_id: Option<Uuid>,
}
