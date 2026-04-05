use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Note {
	pub id: Uuid,
    pub title: String,
    pub owner_id: Option<Uuid>,
    pub owner_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Role Enum
#[derive(Serialize, Deserialize, sqlx::Type, Debug)]
#[sqlx(type_name = "text")]
pub enum Role {
    View,
    Edit,
    Owner,
}

// table schema
#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Share {
	pub id: Uuid,
    pub note_id: Uuid,
    pub url_path: String,
    pub guest_id: Option<Uuid>,
    pub role: Role,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Combined structure for displaying shared note management
#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct ManagedShareItem {
    pub share_id: Uuid,
    pub note_id: Uuid,
    pub note_title: String,
    pub url_path: String,
    pub guest_id: Option<Uuid>,
    pub role: Role,
    pub created_at: DateTime<Utc>,
}

// what we output as response
#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct ShareNotePath {
	pub note_id: Uuid,
    pub guest_id: Uuid,
    pub role: Role,
    pub url_path: String,
}

// what we need in the request
#[derive(Deserialize)]
pub struct ShareNotePayload {
	pub note_id: Uuid,
    pub guest_id: Option<Uuid>,
    pub role: Role,
}


#[derive(Deserialize)]
pub struct CreateNote {
	pub title: String,
}