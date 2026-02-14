use axum::{
    extract::{
        Path, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;
use uuid::Uuid;
use yrs::{ReadTxn, StateVector, Transact, Update, updates::decoder::Decode};

use crate::sync::{AppState, AwarenessState, DocumentRoom};

use super::persistence::{load_note_doc, persist_note_update};

const MSG_SYNC: u8 = 0;
const MSG_AWARENESS: u8 = 1;

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
    let _ = send_initial_awareness(&mut socket, room.clone()).await;
    let mut local_awareness_client_ids = HashSet::new();

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
                let payload = bytes.to_vec();

                if let Some(entries) = decode_awareness_message(&payload) {
                    handle_awareness_update(
                        &room,
                        client_id,
                        entries,
                        &payload,
                        &mut local_awareness_client_ids,
                    )
                    .await;
                    continue;
                }

                let Some(doc_update) = extract_crdt_update_bytes(&payload) else {
                    break;
                };

                if persist_note_update(&state.pool, note_id, doc_update)
                    .await
                    .is_err()
                {
                    break;
                }
                if apply_room_update(&room, doc_update).await.is_err() {
                    break;
                }
                broadcast_to_room(&room, client_id, payload).await;
            }
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) | Message::Text(_) => {}
        }
    }

    writer_task.abort();

    let (remove_room, awareness_removal) = {
        let mut room_guard = room.write().await;
        room_guard.clients.remove(&client_id);

        let awareness_removal = if local_awareness_client_ids.is_empty() {
            None
        } else {
            let mut removed_entries = Vec::new();
            for awareness_client_id in &local_awareness_client_ids {
                if let Some(existing) = room_guard.awareness_states.remove(awareness_client_id) {
                    removed_entries.push(AwarenessUpdateEntry {
                        client_id: *awareness_client_id,
                        clock: existing.clock.saturating_add(1),
                        state_json: "null".to_owned(),
                    });
                }
            }

            if removed_entries.is_empty() {
                None
            } else {
                Some(encode_awareness_message(&removed_entries))
            }
        };

        (room_guard.clients.is_empty(), awareness_removal)
    };

    if let Some(removal_payload) = awareness_removal {
        broadcast_to_room(&room, client_id, removal_payload).await;
    }

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
        awareness_states: HashMap::new(),
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

async fn send_initial_awareness(
    socket: &mut WebSocket,
    room: Arc<RwLock<DocumentRoom>>,
) -> Result<(), axum::Error> {
    let awareness_payload = {
        let room_guard = room.read().await;
        if room_guard.awareness_states.is_empty() {
            return Ok(());
        }

        let mut entries = Vec::with_capacity(room_guard.awareness_states.len());
        for (&awareness_client_id, state) in &room_guard.awareness_states {
            entries.push(AwarenessUpdateEntry {
                client_id: awareness_client_id,
                clock: state.clock,
                state_json: state.state_json.clone(),
            });
        }
        encode_awareness_message(&entries)
    };

    socket.send(Message::Binary(awareness_payload.into())).await
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

async fn handle_awareness_update(
    room: &Arc<RwLock<DocumentRoom>>,
    source_client_id: u64,
    entries: Vec<AwarenessUpdateEntry>,
    raw_payload: &[u8],
    local_awareness_client_ids: &mut HashSet<u64>,
) {
    {
        let mut room_guard = room.write().await;
        for entry in entries {
            if entry.state_json == "null" {
                room_guard.awareness_states.remove(&entry.client_id);
                local_awareness_client_ids.remove(&entry.client_id);
            } else {
                room_guard.awareness_states.insert(
                    entry.client_id,
                    AwarenessState {
                        clock: entry.clock,
                        state_json: entry.state_json,
                    },
                );
                local_awareness_client_ids.insert(entry.client_id);
            }
        }
    }

    broadcast_to_room(room, source_client_id, raw_payload.to_vec()).await;
}

fn extract_crdt_update_bytes(payload: &[u8]) -> Option<&[u8]> {
    if payload.is_empty() {
        return None;
    }

    if payload[0] == MSG_SYNC && payload.len() > 1 && Update::decode_v1(&payload[1..]).is_ok() {
        return Some(&payload[1..]);
    }

    if Update::decode_v1(payload).is_ok() {
        return Some(payload);
    }

    None
}

#[derive(Clone)]
struct AwarenessUpdateEntry {
    client_id: u64,
    clock: u64,
    state_json: String,
}

fn decode_awareness_message(payload: &[u8]) -> Option<Vec<AwarenessUpdateEntry>> {
    if payload.first().copied() != Some(MSG_AWARENESS) {
        return None;
    }

    let mut idx = 1usize;
    let num_entries = decode_var_uint(payload, &mut idx)?;
    let mut entries = Vec::with_capacity(num_entries as usize);

    for _ in 0..num_entries {
        let client_id = decode_var_uint(payload, &mut idx)?;
        let clock = decode_var_uint(payload, &mut idx)?;
        let state_json = decode_var_string(payload, &mut idx)?;
        entries.push(AwarenessUpdateEntry {
            client_id,
            clock,
            state_json,
        });
    }

    if idx != payload.len() {
        return None;
    }

    Some(entries)
}

fn encode_awareness_message(entries: &[AwarenessUpdateEntry]) -> Vec<u8> {
    let mut payload = Vec::new();
    payload.push(MSG_AWARENESS);
    encode_var_uint(entries.len() as u64, &mut payload);

    for entry in entries {
        encode_var_uint(entry.client_id, &mut payload);
        encode_var_uint(entry.clock, &mut payload);
        encode_var_string(&entry.state_json, &mut payload);
    }

    payload
}

fn decode_var_uint(bytes: &[u8], idx: &mut usize) -> Option<u64> {
    let mut value = 0u64;
    let mut shift = 0u32;

    loop {
        let byte = *bytes.get(*idx)?;
        *idx += 1;

        value |= u64::from(byte & 0x7f) << shift;
        if (byte & 0x80) == 0 {
            return Some(value);
        }

        shift = shift.saturating_add(7);
        if shift >= 64 {
            return None;
        }
    }
}

fn encode_var_uint(mut value: u64, out: &mut Vec<u8>) {
    loop {
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        out.push(byte);
        if value == 0 {
            break;
        }
    }
}

fn decode_var_string(bytes: &[u8], idx: &mut usize) -> Option<String> {
    let len = decode_var_uint(bytes, idx)? as usize;
    let end = idx.checked_add(len)?;
    let segment = bytes.get(*idx..end)?;
    *idx = end;
    std::str::from_utf8(segment).ok().map(str::to_owned)
}

fn encode_var_string(value: &str, out: &mut Vec<u8>) {
    encode_var_uint(value.len() as u64, out);
    out.extend_from_slice(value.as_bytes());
}
