use axum::{
    extract::{State, Path, Query, Request, ws::{WebSocketUpgrade, WebSocket}},
    http::StatusCode,
    Json,
    body::to_bytes,
    response::IntoResponse,
};
use crate::models::{Note, NoteSummary, NoteUpdate, CreateNote};
use crate::sync::AppState;
use yrs::{Doc, ReadTxn, StateVector, Text, Transact, Update, updates::decoder::Decode};
use uuid::Uuid;
use std::sync::Arc;
use serde::Deserialize;

pub async fn get_all_notes(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<NoteSummary>>, StatusCode> {
    let notes = sqlx::query_as::<_, NoteSummary>(
        "SELECT id, title_preview, content_preview, created_at, updated_at FROM notes"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(notes))
}

pub async fn get_note(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Note>, StatusCode> {
    let note = sqlx::query_as::<_, Note>(
        "SELECT id, doc_state, created_at, updated_at, title_preview, content_preview \
         FROM notes WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match note {
        Some(note) => Ok(Json(note)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_note(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateNote>,
) -> Result<(StatusCode, Json<NoteSummary>), StatusCode> {
    // Scope Doc so it is dropped before the .await (Doc is !Send)
    let doc_state = {
        let doc = Doc::new();
        let title_text = doc.get_or_insert_text("title");
        let content_text = doc.get_or_insert_text("content");
        {
            let mut txn = doc.transact_mut();
            if let Some(ref t) = payload.title {
                title_text.insert(&mut txn, 0u32, t.as_str());
            }
            if let Some(ref c) = payload.content {
                content_text.insert(&mut txn, 0u32, c.as_str());
            }
        }
        doc.transact().encode_state_as_update_v1(&StateVector::default())
    };

    let note = sqlx::query_as::<_, NoteSummary>(
        "INSERT INTO notes (doc_state, title_preview, content_preview, owner_id) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, title_preview, content_preview, created_at, updated_at"
    )
    .bind(&doc_state)
    .bind(&payload.title)
    .bind(&payload.content)
    .bind(&payload.owner_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(note)))
}

pub async fn delete_note(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM notes WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

const BODY_LIMIT: usize = 2 * 1024 * 1024; // 2MB

pub async fn apply_update(
    State(state): State<Arc<AppState>>,
    Path(note_id): Path<Uuid>,
    request: Request,
) -> Result<StatusCode, StatusCode> {
    let body = to_bytes(request.into_body(), BODY_LIMIT)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let update = Update::decode_v1(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let existing_state: Vec<u8> = sqlx::query_scalar(
        "SELECT doc_state FROM notes WHERE id = $1"
    )
    .bind(note_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // Scope Doc so it is dropped before the next .await (Doc is !Send)
    let new_state = {
        let doc = Doc::new();
        {
            let mut txn = doc.transact_mut();
            txn.apply_update(Update::decode_v1(&existing_state).unwrap());
            txn.apply_update(update);
        }
        doc.transact().encode_state_as_update_v1(&StateVector::default())
    };

    sqlx::query(
        "UPDATE notes SET doc_state = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(&new_state)
    .bind(note_id)
    .execute(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query(
        "INSERT INTO note_updates (note_id, update_data) VALUES ($1, $2)"
    )
    .bind(note_id)
    .bind(body.as_ref())
    .execute(&state.pool)
    .await
    .ok();

    Ok(StatusCode::OK)
}

#[derive(Deserialize)]
pub struct UpdatesSinceParams {
    since: i64,
}

pub async fn get_updates_since(
    State(state): State<Arc<AppState>>,
    Path(note_id): Path<Uuid>,
    Query(params): Query<UpdatesSinceParams>,
) -> Result<Json<Vec<NoteUpdate>>, StatusCode> {
    let updates = sqlx::query_as::<_, NoteUpdate>(
        "SELECT id, note_id, update_data, created_at, client_id \
         FROM note_updates WHERE note_id = $1 AND id > $2 ORDER BY id"
    )
    .bind(note_id)
    .bind(params.since)
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(updates))
}

pub async fn ws_sync(
    State(state): State<Arc<AppState>>,
    Path(note_id): Path<Uuid>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, note_id))
}

async fn handle_socket(_socket: WebSocket, _state: Arc<AppState>, _note_id: Uuid) {
    // TODO: implement sync protocol
    // 1. Load or create DocumentRoom for note_id
    // 2. Send current doc state vector to client
    // 3. Register client in room
    // 4. Loop: forward updates between client and other room members
    // 5. On disconnect: remove client from room
}
