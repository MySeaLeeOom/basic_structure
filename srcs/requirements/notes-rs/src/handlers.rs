use axum::{
    Json, body::to_bytes, extract::{Path, Query, Request, State, ws::{Message, WebSocket, WebSocketUpgrade}}, http::{StatusCode, HeaderValue}, response::{IntoResponse, Response}
};
use crate::models::{Note, NoteSummary, NoteUpdate, CreateNote};
use crate::sync::{AppState, DocumentRoom};
use futures_util::{SinkExt, StreamExt};
use yrs::{Doc, ReadTxn, StateVector, Text, Transact, Update, updates::decoder::Decode};
use uuid::Uuid;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use serde::Deserialize;
use tokio::sync::RwLock;

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

const BODY_LIMIT: usize = 2 * 1024 * 1024;

fn with_legacy_sync_deprecation_headers(
    mut response: Response,
    successor_path: &str,
) -> Response {
    let headers = response.headers_mut();
    headers.insert("Deprecation", HeaderValue::from_static("true"));
    headers.insert("Sunset", HeaderValue::from_static("Wed, 31 Dec 2026 23:59:59 GMT"));
    headers.insert(
        "Warning",
        HeaderValue::from_static(
            "299 - \"Legacy REST sync endpoint is deprecated. Use WebSocket sync endpoint.\"",
        ),
    );
    if let Ok(link) = HeaderValue::from_str(&format!("<{}>; rel=\"successor-version\"", successor_path)) {
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
         FROM note_updates WHERE note_id = $1 AND id > $2 ORDER BY id"
    )
    .bind(note_id)
    .bind(params.since)
    .fetch_all(&state.pool)
    .await
    {
        Ok(updates) => Json(updates).into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    with_legacy_sync_deprecation_headers(
        response,
        &format!("/api/notes/{note_id}/sync"),
    )
}

pub async fn ws_sync(
    State(state): State<Arc<AppState>>,
    Path(note_id): Path<Uuid>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, note_id))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>, note_id: Uuid) {
    let room = match get_or_create_room(&state, note_id).await {
        Ok(room) => room,
        Err(_) => {
            let _ = socket.send(Message::Close(None)).await;
            return;
        }
    };
    let client_id = new_client_id();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();

    {
        let mut room_guard = room.write().await;
        room_guard.clients.insert(client_id, tx);
    }

    let _ = send_initial_state(&mut socket, room.clone()).await;

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let writer_task = tokio::spawn(async move {
        while let Some(bytes) = rx.recv().await {
            if ws_sender.send(Message::Binary(bytes.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(message)) = ws_receiver.next().await {
        match message {
            Message::Binary(bytes) => {
                if persist_ws_update_shell(&state, note_id, bytes.as_ref())
                    .await
                    .is_err()
                {
                    break;
                }
                if apply_room_update(&room, bytes.as_ref()).await.is_err() {
                    break;
                }
                broadcast_to_room(&room, client_id, bytes.to_vec()).await;
            }
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) | Message::Text(_) => {}
        }
    }

    writer_task.abort();

    let remove_room = {
        let mut room_guard = room.write().await;
        room_guard.clients.remove(&client_id);
        room_guard.clients.is_empty()
    };

    if remove_room {
        let mut rooms = state.rooms.write().await;
        let should_remove = rooms
            .get(&note_id)
            .map(|existing_room| Arc::ptr_eq(existing_room, &room))
            .unwrap_or(false);
        if should_remove {
            rooms.remove(&note_id);
        }
    }
}

static NEXT_CLIENT_ID: AtomicU64 = AtomicU64::new(1);

fn new_client_id() -> u64 {
    NEXT_CLIENT_ID.fetch_add(1, Ordering::Relaxed)
}

async fn get_or_create_room(
    state: &Arc<AppState>,
    note_id: Uuid,
) -> Result<Arc<RwLock<DocumentRoom>>, ()> {
    if let Some(existing_room) = state.rooms.read().await.get(&note_id).cloned() {
        return Ok(existing_room);
    }

    let initial_doc = load_note_doc(&state.pool, note_id).await?;
    let candidate_room = Arc::new(RwLock::new(DocumentRoom {
        doc: Arc::new(RwLock::new(initial_doc)),
        clients: HashMap::new(),
    }));

    let mut rooms = state.rooms.write().await;
    let room = rooms
        .entry(note_id)
        .or_insert_with(|| candidate_room.clone())
        .clone();
    Ok(room)
}

async fn send_initial_state(
    socket: &mut WebSocket,
    room: Arc<RwLock<DocumentRoom>>,
) -> Result<(), axum::Error> {
    let initial_update = {
        let room_guard = room.read().await;
        let doc_guard = room_guard.doc.read().await;
        let txn = doc_guard.transact();
        txn.encode_state_as_update_v1(&StateVector::default())
    };
   socket.send(Message::Binary(initial_update.into())).await 
}

async fn apply_room_update(
    room: &Arc<RwLock<DocumentRoom>>,
    update_bytes: &[u8],
) -> Result<(), ()> {
    let room_guard = room.read().await;
    let doc_guard = room_guard.doc.write().await;
    let update = Update::decode_v1(update_bytes).map_err(|_| ())?;
    let mut txn = doc_guard.transact_mut();
    txn.apply_update(update);
    Ok(())
}

async fn broadcast_to_room(
    room: &Arc<RwLock<DocumentRoom>>,
    source_client_id: u64,
    payload: Vec<u8>,
) {
    let mut room_guard = room.write().await;
    room_guard.clients.retain(|client_id, sender| {
        if *client_id == source_client_id {
            return true;
        }
        sender.send(payload.clone()).is_ok()
    });
}

async fn persist_ws_update_shell(
    state: &Arc<AppState>,
    note_id: Uuid,
    update_bytes: &[u8],
) -> Result<(), ()> {
    persist_note_update(&state.pool, note_id, update_bytes)
        .await
        .map_err(|_| ())
}

async fn load_note_doc(pool: &sqlx::PgPool, note_id: Uuid) -> Result<Doc, ()> {
    let existing_state = sqlx::query_scalar::<_, Vec<u8>>("SELECT doc_state FROM notes WHERE id = $1")
        .bind(note_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| ())?
        .ok_or(())?;

    let doc = Doc::new();
    {
        let mut txn = doc.transact_mut();
        let existing_update = Update::decode_v1(&existing_state).map_err(|_| ())?;
        txn.apply_update(existing_update);
    }
    Ok(doc)
}

async fn persist_note_update(
    pool: &sqlx::PgPool,
    note_id: Uuid,
    update_bytes: &[u8],
) -> Result<(), StatusCode> {
    let existing_state = sqlx::query_scalar::<_, Vec<u8>>("SELECT doc_state FROM notes WHERE id = $1")
        .bind(note_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let incoming_update = Update::decode_v1(update_bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    let new_state = {
        let doc = Doc::new();
        {
            let mut txn = doc.transact_mut();
            let existing_update = Update::decode_v1(&existing_state)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            txn.apply_update(existing_update);
            txn.apply_update(incoming_update);
        }
        doc.transact().encode_state_as_update_v1(&StateVector::default())
    };

    let mut tx = pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("UPDATE notes SET doc_state = $1, updated_at = NOW() WHERE id = $2")
        .bind(&new_state)
        .bind(note_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("INSERT INTO note_updates (note_id, update_data) VALUES ($1, $2)")
        .bind(note_id)
        .bind(update_bytes)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(())
}
