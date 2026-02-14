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

#[derive(Deserialize)]
pub struct CreateNote {
	pub doc_state: Vec<u8>,
	pub owner_id: Option<Uuid>,
	pub title: Option<String>,
	pub content: Option<String>,
}