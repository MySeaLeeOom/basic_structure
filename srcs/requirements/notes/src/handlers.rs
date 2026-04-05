use axum::{extract::{State, Path}, http::HeaderMap, http::StatusCode, Json};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Note, CreateNote, Share, ShareNotePayload, Role, ManagedShareItem};
use chrono::Utc; // Ensure Utc is imported for timestamps

fn get_user_id(headers: &HeaderMap) -> Result<Uuid, StatusCode> {
	headers.get("X-User-Id")
		.and_then(|v| v.to_str().ok())
		.and_then(|v| Uuid::parse_str(v).ok())
		.ok_or(StatusCode::UNAUTHORIZED)
}

pub async fn get_all_notes(State(pool): State<PgPool>, headers: HeaderMap) -> Result<Json<Vec<Note>>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::debug!("Fetching all notes for user {}", user_id);
	let notes = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, owner_url, created_at, updated_at FROM notes WHERE owner_id = $1")
		.bind(user_id)
		.fetch_all(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch notes: {}", e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	Ok(Json(notes))
}

// Simple fetch all notes... that are shared with the specific user
pub async fn get_all_shared_notes(State(pool): State<PgPool>, headers: HeaderMap) -> Result<Json<Vec<Note>>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::debug!("Fetching all notes shared with user {}", user_id);
	let shares_notes = sqlx::query_as::<_, Note>("SELECT notes.id, notes.title, notes.owner_id, notes.owner_url, notes.created_at, notes.updated_at
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

	Ok(Json(shares_notes))
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

    // Verify that the requesting user is indeed the owner of the note.
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
        None => {
            tracing::warn!("Note {} not found. Cannot create share.", payload.note_id);
            return Err(StatusCode::NOT_FOUND);
        }
    };

    if owner_id != requesting_user_id {
        tracing::warn!("User {} is not the owner of note {} and cannot create a share.", requesting_user_id, payload.note_id);
        return Err(StatusCode::FORBIDDEN);
    }

    // Unique identifiers and timestamps for the new share record.
    let share_id = Uuid::new_v4();
    let share_token = Uuid::new_v4().to_string();
    let current_time = Utc::now();

    // Insert the new share record into the 'share' table.
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
        tracing::error!("Failed to insert share for note {}: {}", payload.note_id, e);
        if let Some(db_err) = e.as_database_error() {
            if db_err.is_unique_violation() {
                tracing::warn!("Attempted to create duplicate share: note_id={:?}, guest_id={:?}, role={:?}", payload.note_id, payload.guest_id, payload.role);
                return StatusCode::CONFLICT;
            }
        }
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Share {} created for note {}. Guest ID: {:?}, Role: {:?}, URL Path: {}",
                   new_share.id, new_share.note_id, new_share.guest_id, new_share.role, new_share.url_path.as_deref().unwrap_or("N/A"));

    //Return the full Share object, which includes the generated 'url_path' (token).
    Ok(Json(new_share))
}

pub async fn get_note(State(pool): State<PgPool>, Path(id): Path<Uuid>, headers: HeaderMap) -> Result<Json<Note>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::debug!("Fetching note {} for user {}", id, user_id);
	let note = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, owner_url, created_at, updated_at FROM notes WHERE id = $1 AND owner_id = $2")
		.bind(id)
		.bind(user_id)
		.fetch_optional(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => {
			tracing::warn!("Note {} not found for user {}", id, user_id);
			Err(StatusCode::NOT_FOUND)
		}
	}
}

pub async fn post_note(State(pool): State<PgPool>, headers: HeaderMap, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::info!("Creating new note: {} for user {}", payload.title, user_id);
	
	let mut tx = pool.begin().await.map_err(|e| {
		tracing::error!("Failed to begin transaction: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

	let note = sqlx::query_as::<_, Note>(
		"INSERT INTO notes (title, owner_id) VALUES ($1, $2) RETURNING id, title, owner_id, owner_url, created_at, updated_at",
	)
	.bind(&payload.title)
	.bind(user_id)
	.fetch_one(&mut *tx)
	.await
	.map_err(|e| {
		tracing::error!("Failed to insert note: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

	// Valid empty yrs state vector (v1)
	let empty_state = vec![0u8, 0u8];
	
	sqlx::query("INSERT INTO note_states (note_id, state_vector) VALUES ($1, $2)")
		.bind(note.id)
		.bind(&empty_state) 
		.execute(&mut *tx)
		.await
		.map_err(|e| {
			tracing::error!("Failed to insert note state: {}", e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	tx.commit().await.map_err(|e| {
		tracing::error!("Failed to commit transaction: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

	tracing::info!("Note {} created successfully", note.id);
	Ok(Json(note))
}

pub async fn del_note(State(pool): State<PgPool>, Path(id): Path<Uuid>, headers: HeaderMap) -> Result<StatusCode, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::info!("Deleting note {} for user {}", id, user_id);
	let result = sqlx::query("DELETE FROM notes WHERE id = $1 AND owner_id = $2")
		.bind(id)
		.bind(user_id)
		.execute(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to delete note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	if result.rows_affected() == 0 {
		tracing::warn!("Note {} not found for deletion (or not owned by user)", id);
		return Err(StatusCode::NOT_FOUND);
	}

	tracing::info!("Note {} deleted successfully", id);
	Ok(StatusCode::NO_CONTENT)
}

pub async fn edit_title(State(pool): State<PgPool>, Path(id): Path<Uuid>, headers: HeaderMap, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::info!("Updating title for note {}: {}", id, payload.title);
	let note = sqlx::query_as::<_, Note>(
		"UPDATE notes SET title = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING id, title, owner_id, created_at, updated_at"
		)
		.bind(payload.title)
		.bind(id)
		.bind(user_id)
		.fetch_optional(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to update note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?; 

	match note {
		Some(note) => {
			tracing::info!("Note {} updated successfully", id);
			Ok(Json(note))
		},
		None => {
			tracing::warn!("Note {} not found for update", id);
			Err(StatusCode::NOT_FOUND)
		}
	}
}
