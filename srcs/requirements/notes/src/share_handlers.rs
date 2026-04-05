use axum::{extract::{State, Path}, http::HeaderMap, http::StatusCode, Json};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Note, Share, ShareNotePayload, ManagedShareItem};
use chrono::Utc;

// We reuse the get_user_id function from handlers.rs
use crate::handlers::get_user_id;

// Fetch all notes that are shared with the specific user
pub async fn get_all_shared_notes(State(pool): State<PgPool>, headers: HeaderMap) -> Result<Json<Vec<Note>>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::debug!("Fetching all notes shared with user {}", user_id);
	let shared_notes = sqlx::query_as::<_, Note>("SELECT notes.id, notes.title, notes.owner_id, notes.owner_url, notes.created_at, notes.updated_at
		FROM notes
		INNER JOIN share ON notes.id = share.note_id
		WHERE share.guest_id = $1")
		.bind(user_id)
		.fetch_all(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch shared notes: {}", e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	Ok(Json(shared_notes))
}

// Fetch a single note that has been shared with the user
pub async fn get_shared_note(State(pool): State<PgPool>, Path(id): Path<Uuid>, headers: HeaderMap) -> Result<Json<Note>, StatusCode> {
    let user_id = get_user_id(&headers)?;
    tracing::debug!("Fetching shared note {} for guest {}", id, user_id);
    let note = sqlx::query_as::<_, Note>(
        "SELECT n.id, n.title, n.owner_id, n.owner_url, n.created_at, n.updated_at 
         FROM notes n 
         INNER JOIN share s ON n.id = s.note_id 
         WHERE n.id = $1 AND (s.guest_id = $2 OR s.guest_id IS NULL)"
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch shared note {}: {}", id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?; 

    match note {
        Some(note) => Ok(Json(note)),
        None => Err(StatusCode::NOT_FOUND)
    }
}

// Fetch every single share linking to any note owned by this user
pub async fn get_all_managed_shares(State(pool): State<PgPool>, headers: HeaderMap) -> Result<Json<Vec<ManagedShareItem>>, StatusCode> {
    let owner_id = get_user_id(&headers)?;
    tracing::debug!("Fetching all shares managed by user {}", owner_id);

    let managed_shares = sqlx::query_as::<_, ManagedShareItem>(
        "SELECT s.id as share_id, n.id as note_id, n.title as note_title, s.url_path, s.guest_id, s.role, s.created_at
         FROM share s
         INNER JOIN notes n ON s.note_id = n.id
         WHERE n.owner_id = $1
         ORDER BY s.created_at DESC"
    )
    .bind(owner_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch managed shares: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(managed_shares))
}

pub async fn share_note(State(pool): State<PgPool>, headers: HeaderMap, Json(payload): Json<ShareNotePayload>) -> Result<Json<Share>, StatusCode> {
    let requesting_user_id = get_user_id(&headers)?;
    tracing::debug!("Attempting to create a share for note {} by user {}", payload.note_id, requesting_user_id);

    let note_owner_id = sqlx::query_scalar::<_, Uuid>("SELECT owner_id FROM notes WHERE id = $1")
        .bind(payload.note_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query note ownership for note {}: {}", payload.note_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let owner_id = match note_owner_id {
        Some(id) => id,
        None => return Err(StatusCode::NOT_FOUND),
    };

    if owner_id != requesting_user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    let share_id = Uuid::new_v4();
    let share_token = Uuid::new_v4().to_string();
    let current_time = Utc::now();

    let new_share = sqlx::query_as::<_, Share>(
        "INSERT INTO share (id, note_id, url_path, guest_id, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, note_id, url_path, guest_id, role, created_at, updated_at"
    )
    .bind(share_id)
    .bind(payload.note_id)
    .bind(&share_token)
    .bind(payload.guest_id)
    .bind(payload.role)
    .bind(current_time)
    .bind(current_time)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error() {
            if db_err.is_unique_violation() {
                return StatusCode::CONFLICT;
            }
        }
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Share {} created for note {}. Guest ID: {:?}, Role: {:?}, URL Path: {}",
                   new_share.id, new_share.note_id, new_share.guest_id, new_share.role, new_share.url_path);

    Ok(Json(new_share))
}

pub async fn remove_note_share(State(pool): State<PgPool>, Path(share_id): Path<Uuid>, headers: HeaderMap) -> Result<StatusCode, StatusCode> {
    let requesting_user_id = get_user_id(&headers)?;
    tracing::info!("Attempting to delete share {} by user {}", share_id, requesting_user_id);

    // Ensure the person attempting to delete the share is the structural owner of the note
    let result = sqlx::query(
        "DELETE FROM share 
         USING notes 
         WHERE share.note_id = notes.id AND share.id = $1 AND notes.owner_id = $2"
    )
    .bind(share_id)
    .bind(requesting_user_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete share {}: {}", share_id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        tracing::warn!("Share {} not found or user {} is not the owner", share_id, requesting_user_id);
        return Err(StatusCode::NOT_FOUND);
    }

    tracing::info!("Share {} deleted successfully", share_id);
    Ok(StatusCode::NO_CONTENT)
}