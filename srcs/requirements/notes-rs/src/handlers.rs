use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use crate::models::{Note, CreateNote};

pub async fn get_notes(State(pool): State<PgPool>) -> Result<Json<Vec<Note>>, StatusCode> {
    let notes = sqlx::query_as::<_, Note>("SELECT id, title, content FROM notes")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(notes))
}

pub async fn post_note(State(pool): State<PgPool>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
    let note = sqlx::query_as::<_, Note>(
        "INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING id, title, content",
    )
    .bind(payload.title)
    .bind(payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(note))
}