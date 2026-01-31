use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Note {
    pub id: i32,
    pub title: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct CreateNote {
    pub title: String,
    pub content: String,
}