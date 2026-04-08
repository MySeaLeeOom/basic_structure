use axum::{extract::{State, Path}, http::{HeaderMap, StatusCode}, Json};
use sqlx::PgPool;
use crate::models::Note;
use crate::handlers::get_user_id;

pub async fn get_note_by_slug(
    State(pool): State<PgPool>,
    Path(slug): Path<String>,
    headers: HeaderMap
) -> Result<Json<Note>, StatusCode> {
    let user_id = get_user_id(&headers)?;
    
    tracing::debug!("Searching for note by slug '{}' for user {}", slug, user_id);

    // First principles: Look for the slug in the owner_url column
    let note = sqlx::query_as::<_, Note>(
        "SELECT id, title, owner_id, owner_url, created_at, updated_at 
         FROM notes 
         WHERE owner_url = $1 AND owner_id = $2"
    )
    .bind(&slug)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to lookup note by slug {}: {}", slug, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match note {
        Some(note) => Ok(Json(note)),
        None => Err(StatusCode::NOT_FOUND)
    }
}
