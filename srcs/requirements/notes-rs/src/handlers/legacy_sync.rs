use axum::{
    Json,
    body::to_bytes,
    extract::{Path, Query, Request, State},
    http::{HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::NoteUpdate;
use crate::sync::AppState;

use super::persistence::persist_note_update;

const BODY_LIMIT: usize = 2 * 1024 * 1024;

fn with_legacy_sync_deprecation_headers(mut response: Response, successor_path: &str) -> Response {
    let headers = response.headers_mut();
    headers.insert("Deprecation", HeaderValue::from_static("true"));
    headers.insert(
        "Sunset",
        HeaderValue::from_static("Wed, 31 Dec 2026 23:59:59 GMT"),
    );
    headers.insert(
        "Warning",
        HeaderValue::from_static(
            "299 - \"Legacy REST sync endpoint is deprecated. Use WebSocket sync endpoint.\"",
        ),
    );
    if let Ok(link) =
        HeaderValue::from_str(&format!("<{}>; rel=\"successor-version\"", successor_path))
    {
        headers.insert("Link", link);
    }
    response
}

pub async fn apply_update(
    State(state): State<Arc<AppState>>,
    Path(note_id): Path<Uuid>,
    request: Request,
) -> impl IntoResponse {
    eprintln!(
        "Deprecated endpoint used: POST /api/notes/{note_id}/update. Prefer /api/notes/{note_id}/sync."
    );

    let result: Result<(), StatusCode> = async {
        let body = to_bytes(request.into_body(), BODY_LIMIT)
            .await
            .map_err(|_| StatusCode::BAD_REQUEST)?;

        persist_note_update(&state.pool, note_id, body.as_ref()).await?;

        Ok(())
    }
    .await;

    let status = match result {
        Ok(()) => StatusCode::OK,
        Err(code) => code,
    };

    with_legacy_sync_deprecation_headers(
        status.into_response(),
        &format!("/api/notes/{note_id}/sync"),
    )
}

#[derive(Deserialize)]
pub struct UpdatesSinceParams {
    since: i64,
}

pub async fn get_updates_since(
    State(state): State<Arc<AppState>>,
    Path(note_id): Path<Uuid>,
    Query(params): Query<UpdatesSinceParams>,
) -> impl IntoResponse {
    eprintln!(
        "Deprecated endpoint used: GET /api/notes/{note_id}/updates. Prefer /api/notes/{note_id}/sync."
    );

    let response = match sqlx::query_as::<_, NoteUpdate>(
        "SELECT id, note_id, update_data, created_at, client_id \
         FROM note_updates WHERE note_id = $1 AND id > $2 ORDER BY id",
    )
    .bind(note_id)
    .bind(params.since)
    .fetch_all(&state.pool)
    .await
    {
        Ok(updates) => Json(updates).into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    with_legacy_sync_deprecation_headers(response, &format!("/api/notes/{note_id}/sync"))
}
