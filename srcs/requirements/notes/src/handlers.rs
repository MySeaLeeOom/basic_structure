use axum::{extract::{State, Path}, http::StatusCode, Json};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Note, CreateNote};

pub async fn get_all_notes(State(pool): State<PgPool>) -> Result<Json<Vec<Note>>, StatusCode> {
	tracing::debug!("Fetching all notes");
	let notes = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, created_at, updated_at FROM notes")
		.fetch_all(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch notes: {}", e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	Ok(Json(notes))
}

pub async fn get_note(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<Json<Note>, StatusCode> {
	tracing::debug!("Fetching note {}", id);
	let note = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, created_at, updated_at FROM notes WHERE id = $1")
		.bind(id)
		.fetch_optional(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => {
			tracing::warn!("Note {} not found", id);
			Err(StatusCode::NOT_FOUND)
		}
	}
}

pub async fn post_note(State(pool): State<PgPool>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	tracing::info!("Creating new note: {}", payload.title);
	
	let mut tx = pool.begin().await.map_err(|e| {
		tracing::error!("Failed to begin transaction: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

	let note = sqlx::query_as::<_, Note>(
		"INSERT INTO notes (title) VALUES ($1) RETURNING id, title, owner_id, created_at, updated_at",
	)
	.bind(&payload.title)
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

pub async fn del_note(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<StatusCode, StatusCode> {
	tracing::info!("Deleting note {}", id);
	let result = sqlx::query("DELETE FROM notes WHERE id = $1")
		.bind(id)
		.execute(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to delete note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	if result.rows_affected() == 0 {
		tracing::warn!("Note {} not found for deletion", id);
		return Err(StatusCode::NOT_FOUND);
	}

	tracing::info!("Note {} deleted successfully", id);
	Ok(StatusCode::NO_CONTENT)
}

pub async fn edit_title(State(pool): State<PgPool>, Path(id): Path<Uuid>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	tracing::info!("Updating title for note {}: {}", id, payload.title);
	let note = sqlx::query_as::<_, Note>(
		"UPDATE notes SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, owner_id, created_at, updated_at"
		)
		.bind(payload.title)
		.bind(id)
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