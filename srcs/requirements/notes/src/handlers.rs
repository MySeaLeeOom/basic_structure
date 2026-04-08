use axum::{extract::{State, Path}, http::HeaderMap, http::StatusCode, Json};
use serde::Serialize;
use uuid::Uuid;
use crate::metrics;
use crate::models::{Note, CreateNote};
use crate::AppState;

#[derive(Serialize)]
struct ErrorResponse {
	message: String,
}

type ApiError = (StatusCode, Json<ErrorResponse>);

fn requested_locale(headers: &HeaderMap, default_locale: &str) -> String {
	headers
		.get("Accept-Language")
		.and_then(|v| v.to_str().ok())
		.and_then(|v| v.split(',').next())
		.map(str::trim)
		.filter(|v| !v.is_empty())
		.map(ToString::to_string)
		.unwrap_or_else(|| default_locale.to_string())
}

fn error_response(state: &AppState, locale: &str, status: StatusCode, key: &str) -> ApiError {
	let msg = state.i18n.t(locale, key);
	(status, Json(ErrorResponse { message: msg }))
}

fn get_user_id(headers: &HeaderMap) -> Result<Uuid, ()> {
	headers.get("X-User-Id")
		.and_then(|v| v.to_str().ok())
		.and_then(|v| Uuid::parse_str(v).ok())
		.ok_or(())
}

pub async fn get_all_notes(State(state): State<AppState>, headers: HeaderMap) -> Result<Json<Vec<Note>>, ApiError> {
	let locale = requested_locale(&headers, state.i18n.default_locale());
	let user_id = get_user_id(&headers)
		.map_err(|_| error_response(&state, &locale, StatusCode::UNAUTHORIZED, "unauthorized"))?;
	tracing::debug!("Fetching all notes for user {}", user_id);
	let notes = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, created_at, updated_at FROM notes WHERE owner_id = $1")
		.bind(user_id)
		.fetch_all(&state.db_pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch notes: {}", e);
			error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
		})?;

	Ok(Json(notes))
}

pub async fn get_note(State(state): State<AppState>, Path(id): Path<Uuid>, headers: HeaderMap) -> Result<Json<Note>, ApiError> {
	let locale = requested_locale(&headers, state.i18n.default_locale());
	let user_id = get_user_id(&headers)
		.map_err(|_| error_response(&state, &locale, StatusCode::UNAUTHORIZED, "unauthorized"))?;
	tracing::debug!("Fetching note {} for user {}", id, user_id);
	let note = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, created_at, updated_at FROM notes WHERE id = $1 AND owner_id = $2")
		.bind(id)
		.bind(user_id)
		.fetch_optional(&state.db_pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch note {}: {}", id, e);
			error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
		})?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => {
			tracing::warn!("Note {} not found for user {}", id, user_id);
			Err(error_response(&state, &locale, StatusCode::NOT_FOUND, "note-not-found"))
		}
	}
}

pub async fn post_note(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<CreateNote>) -> Result<Json<Note>, ApiError> {
	let locale = requested_locale(&headers, state.i18n.default_locale());
	let user_id = get_user_id(&headers)
		.map_err(|_| error_response(&state, &locale, StatusCode::UNAUTHORIZED, "unauthorized"))?;
	tracing::info!("Creating new note: {} for user {}", payload.title, user_id);
	
	let mut tx = state.db_pool.begin().await.map_err(|e| {
		tracing::error!("Failed to begin transaction: {}", e);
		error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
	})?;

	let note = sqlx::query_as::<_, Note>(
		"INSERT INTO notes (title, owner_id) VALUES ($1, $2) RETURNING id, title, owner_id, created_at, updated_at",
	)
	.bind(&payload.title)
	.bind(user_id)
	.fetch_one(&mut *tx)
	.await
	.map_err(|e| {
		tracing::error!("Failed to insert note: {}", e);
		error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
	})?;

	let empty_state = vec![0u8, 0u8];
	
	sqlx::query("INSERT INTO note_states (note_id, state_vector) VALUES ($1, $2)")
		.bind(note.id)
		.bind(&empty_state) 
		.execute(&mut *tx)
		.await
		.map_err(|e| {
			tracing::error!("Failed to insert note state: {}", e);
			error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
		})?;

	tx.commit().await.map_err(|e| {
		tracing::error!("Failed to commit transaction: {}", e);
		error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
	})?;

	metrics::inc_mutation("create");
	tracing::info!("Note {} created successfully", note.id);
	Ok(Json(note))
}

pub async fn del_note(State(state): State<AppState>, Path(id): Path<Uuid>, headers: HeaderMap) -> Result<StatusCode, ApiError> {
	let locale = requested_locale(&headers, state.i18n.default_locale());
	let user_id = get_user_id(&headers)
		.map_err(|_| error_response(&state, &locale, StatusCode::UNAUTHORIZED, "unauthorized"))?;
	tracing::info!("Deleting note {} for user {}", id, user_id);
	let result = sqlx::query("DELETE FROM notes WHERE id = $1 AND owner_id = $2")
		.bind(id)
		.bind(user_id)
		.execute(&state.db_pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to delete note {}: {}", id, e);
			error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
		})?;

	if result.rows_affected() == 0 {
		tracing::warn!("Note {} not found for deletion (or not owned by user)", id);
		return Err(error_response(&state, &locale, StatusCode::NOT_FOUND, "note-not-found"));
	}

	metrics::inc_mutation("delete");
	tracing::info!("Note {} deleted successfully", id);
	Ok(StatusCode::NO_CONTENT)
}

pub async fn edit_title(State(state): State<AppState>, Path(id): Path<Uuid>, headers: HeaderMap, Json(payload): Json<CreateNote>) -> Result<Json<Note>, ApiError> {
	let locale = requested_locale(&headers, state.i18n.default_locale());
	let user_id = get_user_id(&headers)
		.map_err(|_| error_response(&state, &locale, StatusCode::UNAUTHORIZED, "unauthorized"))?;
	tracing::info!("Updating title for note {}: {}", id, payload.title);
	let note = sqlx::query_as::<_, Note>(
		"UPDATE notes SET title = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING id, title, owner_id, created_at, updated_at"
		)
		.bind(payload.title)
		.bind(id)
		.bind(user_id)
		.fetch_optional(&state.db_pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to update note {}: {}", id, e);
			error_response(&state, &locale, StatusCode::INTERNAL_SERVER_ERROR, "internal-error")
		})?; 

	match note {
		Some(note) => {
			tracing::info!("Note {} updated successfully", id);
			Ok(Json(note))
		},
		None => {
			tracing::warn!("Note {} not found for update", id);
			Err(error_response(&state, &locale, StatusCode::NOT_FOUND, "note-not-found"))
		}
	}
}
