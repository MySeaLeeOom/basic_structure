use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;
use crate::metrics;
use crate::models::{Note, CreateNote};

use crate::{
    models::{CreateNote, Note},
    AppState,
};

#[derive(Serialize)]
struct ErrorBody {
    message: String,
}

pub(crate) struct ApiError {
    status: StatusCode,
    message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(ErrorBody { message: self.message })).into_response()
    }
}

fn parse_accept_language(header: Option<&str>) -> Vec<String> {
    // Returns locale preferences sorted by quality descending.
    // Example input: "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
    let Some(raw) = header else {
        return vec!["en-uk".to_string()];
    };

    let mut parsed: Vec<(String, f32, usize)> = raw
        .split(',')
        .enumerate()
        .filter_map(|(idx, part)| {
            let part = part.trim();
            if part.is_empty() {
                return None;
            }

            let mut segs = part.split(';');
            let tag_raw = segs.next()?.trim();
            if tag_raw == "*" || tag_raw.is_empty() {
                return None;
            }

            let tag = tag_raw.to_ascii_lowercase().replace('_', "-");

            let mut q = 1.0_f32;
            for param in segs {
                let p = param.trim();
                if let Some(v) = p.strip_prefix("q=") {
                    if let Ok(n) = v.parse::<f32>() {
                        if (0.0..=1.0).contains(&n) {
                            q = n;
                        }
                    }
                }
            }

            Some((tag, q, idx))
        })
        .collect();

    // stable ordering: quality desc, then original order
    parsed.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.2.cmp(&b.2))
    });

    let mut out = Vec::new();
    for (tag, _, _) in parsed {
        // include exact tag first
        if !out.contains(&tag) {
            out.push(tag.clone());
        }

        // include language-only fallback (e.g. "de-de" -> "de")
        if let Some(lang) = tag.split('-').next() {
            let lang = lang.to_string();
            if !lang.is_empty() && !out.contains(&lang) {
                out.push(lang);
            }
        }
    }

    if out.is_empty() {
        out.push("en-uk".to_string());
    }

    out
}

fn preferred_locales(headers: &HeaderMap) -> Vec<String> {
    parse_accept_language(
        headers
            .get("Accept-Language")
            .and_then(|v| v.to_str().ok()),
    )
	metrics::inc_mutation("create");
	tracing::info!("Note {} created successfully", note.id);
	Ok(Json(note))
}

// pub async fn del_note(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<StatusCode, StatusCode> {
// 	tracing::info!("Deleting note {}", id);
// 	let result = sqlx::query("DELETE FROM notes WHERE id = $1")
// 		.bind(id)
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
		// tracing::warn!("Note {} not found for deletion", id);
		tracing::warn!("Note {} not found for deletion (or not owned by user)", id);
		return Err(StatusCode::NOT_FOUND);
	}

	metrics::inc_mutation("delete");
	tracing::info!("Note {} deleted successfully", id);
	Ok(StatusCode::NO_CONTENT)
}

fn t(state: &AppState, headers: &HeaderMap, key: &str) -> String {
    for locale in preferred_locales(headers) {
        let text = state.i18n.t(&locale, key);
        if text != key {
            return text;
        }
    }
    state.i18n.t(state.i18n.default_locale(), key)
}

fn get_user_id(headers: &HeaderMap) -> Result<Uuid, ApiError> {
    headers
        .get("X-User-Id")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| Uuid::parse_str(v).ok())
        .ok_or(ApiError {
            status: StatusCode::UNAUTHORIZED,
            message: "unauthorized".to_string(), // replaced in handlers with localized text
        })
}

pub async fn get_all_notes(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Note>>, ApiError> {
    let user_id = get_user_id(&headers).map_err(|_| ApiError {
        status: StatusCode::UNAUTHORIZED,
        message: t(&state, &headers, "unauthorized"),
    })?;

    let notes = sqlx::query_as::<_, Note>(
        "SELECT id, title, owner_id, created_at, updated_at FROM notes WHERE owner_id = $1",
    )
    .bind(user_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch notes: {}", e);
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: t(&state, &headers, "internal-error"),
        }
    })?;

    Ok(Json(notes))
}

pub async fn get_note(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<Note>, ApiError> {
    let user_id = get_user_id(&headers).map_err(|_| ApiError {
        status: StatusCode::UNAUTHORIZED,
        message: t(&state, &headers, "unauthorized"),
    })?;

    let note = sqlx::query_as::<_, Note>(
        "SELECT id, title, owner_id, created_at, updated_at FROM notes WHERE id = $1 AND owner_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch note {}: {}", id, e);
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: t(&state, &headers, "internal-error"),
        }
    })?;

    match note {
        Some(note) => Ok(Json(note)),
        None => Err(ApiError {
            status: StatusCode::NOT_FOUND,
            message: t(&state, &headers, "note-not-found"),
        }),
    }
}

pub async fn post_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateNote>,
) -> Result<Json<Note>, ApiError> {
    let user_id = get_user_id(&headers).map_err(|_| ApiError {
        status: StatusCode::UNAUTHORIZED,
        message: t(&state, &headers, "unauthorized"),
    })?;

    let mut tx = state.db_pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: t(&state, &headers, "internal-error"),
        }
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
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: t(&state, &headers, "internal-error"),
        }
    })?;

    let empty_state = vec![0u8, 0u8];

    sqlx::query("INSERT INTO note_states (note_id, state_vector) VALUES ($1, $2)")
        .bind(note.id)
        .bind(&empty_state)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to insert note state: {}", e);
            ApiError {
                status: StatusCode::INTERNAL_SERVER_ERROR,
                message: t(&state, &headers, "internal-error"),
            }
        })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {}", e);
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: t(&state, &headers, "internal-error"),
        }
    })?;

    Ok(Json(note))
}

pub async fn del_note(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<StatusCode, ApiError> {
    let user_id = get_user_id(&headers).map_err(|_| ApiError {
        status: StatusCode::UNAUTHORIZED,
        message: t(&state, &headers, "unauthorized"),
    })?;

    let result = sqlx::query("DELETE FROM notes WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete note {}: {}", id, e);
            ApiError {
                status: StatusCode::INTERNAL_SERVER_ERROR,
                message: t(&state, &headers, "internal-error"),
            }
        })?;

    if result.rows_affected() == 0 {
        return Err(ApiError {
            status: StatusCode::NOT_FOUND,
            message: t(&state, &headers, "note-not-found"),
        });
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn edit_title(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<CreateNote>,
) -> Result<Json<Note>, ApiError> {
    let user_id = get_user_id(&headers).map_err(|_| ApiError {
        status: StatusCode::UNAUTHORIZED,
        message: t(&state, &headers, "unauthorized"),
    })?;

    let note = sqlx::query_as::<_, Note>(
        "UPDATE notes SET title = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3 RETURNING id, title, owner_id, created_at, updated_at",
    )
    .bind(payload.title)
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update note {}: {}", id, e);
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: t(&state, &headers, "internal-error"),
        }
    })?;

    match note {
        Some(note) => Ok(Json(note)),
        None => Err(ApiError {
            status: StatusCode::NOT_FOUND,
            message: t(&state, &headers, "note-not-found"),
        }),
    }
}