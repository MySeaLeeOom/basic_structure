use axum::{
	extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, State},
	http::{HeaderMap, StatusCode},
	response::Response,
};
use futures_util::{stream::StreamExt, SinkExt};
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::state::{AppState, DocumentRoom};
use crate::db;
use crate::sync;

// global counter to assign unique IDs to clients (for awareness tracking)
static NEXT_CLIENT_ID: AtomicUsize = AtomicUsize::new(1);

// ws route handler
pub async fn ws_route(
	ws: WebSocketUpgrade,
	Path(note_id): Path<Uuid>,
	State(state): State<Arc<AppState>>,
	headers: HeaderMap,
) -> Response {
	// 1. Identity Extraction: Nginx (gateway) verified the session and injected these headers
	let user_id = match headers.get("X-User-Id")
		.and_then(|v| v.to_str().ok())
		.and_then(|v| Uuid::parse_str(v).ok()) {
			Some(id) => id,
			None => {
				tracing::warn!("Unauthorized: Missing or invalid X-User-Id header for note {}", note_id);
				return StatusCode::UNAUTHORIZED.into_response();
			}
		};

	let role = headers.get("X-User-Role")
		.and_then(|v| v.to_str().ok())
		.unwrap_or("user");

	tracing::debug!("WebSocket request: user={} role={} note={}", user_id, role, note_id);

	// 2. Authorization Check: Admins can see anything, users must own the note
	if role != "admin" {
		if !db::check_ownership(&state.pool, note_id, user_id).await {
			tracing::warn!("Forbidden: User {} (role={}) attempted to access note {} without ownership", user_id, role, note_id);
			return StatusCode::FORBIDDEN.into_response();
		}
	}

	// 3. Upgrade Connection: All checks passed, hand over to the real-time handler
	ws.on_upgrade(move |socket| handle_socket(socket, note_id, state))
}

async fn handle_socket(socket: WebSocket, note_id: Uuid, state: Arc<AppState>) {
	// find or create room if not exists
	let room = if let Some(existing_room) = state.rooms.get(&note_id) {
		existing_room.clone()
	} else {
		// load data from db
		match db::load_note(&state.pool, note_id).await {
			Ok(doc) => {
				tracing::info!("Loaded note {} from database", note_id);
				let new_room = Arc::new(DocumentRoom::new(doc));
				state.rooms.insert(note_id, new_room.clone());
				new_room
			}
			Err(_) => {
				tracing::error!("Failed to load document {}", note_id);
				return;
			}
		}
	};

	// register client
	let client_id = NEXT_CLIENT_ID.fetch_add(1, Ordering::Relaxed);
	tracing::debug!("Registering client {} for note {}", client_id, note_id);

	// channel: tx to receive messages from other clients, rx to send messages to this client. Pipe tx -> rx.
	let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
	room.clients.insert(client_id, tx.clone());

	// and another channel: sender to send messages to others, receiver to receive messages from this client
	let (mut sender, mut receiver) = socket.split();

	// send state vector and awareness info to the new client
	let init_sync: Vec<u8> = sync::generate_initial_sync(&room.doc).await;
	let _ = sender.send(Message::Binary(init_sync.into())).await;

	let init_awareness: Vec<u8> = sync::generate_initial_awareness(&room.awareness).await;
	let _ = sender.send(Message::Binary(init_awareness.into())).await;

	// everything that ends up at rx (from other clients) should be sent to the client via sender(ws).
	let mut send_task = tokio::spawn(async move {
		while let Some(msg) = rx.recv().await {
			if sender.send(msg).await.is_err() {
				break;
			}
		}
	});

	// main loop for receiving messages from the client
	let room_clone = room.clone();
	let mut recv_task = tokio::spawn(async move {
		while let Some(Ok(msg)) = receiver.next().await {
			if let Message::Binary(bytes) = msg {
				// give raw bytes to the sync logic. If we get a response (OK + non empty), we broadcast it.
				match sync::process_binary_message(&bytes, &room_clone.doc, &room_clone.awareness).await {
					Ok(response_bytes) => {
						if !response_bytes.is_empty() {
							let broadcast_msg = Message::Binary(response_bytes.into());
							
							for client in room_clone.clients.iter() {
								if *client.key() != client_id {
									let _ = client.value().send(broadcast_msg.clone());
								}
							}
						}
					}
					Err(e) => {
						tracing::error!("Error processing binary message from client {}: {}", client_id, e);
					}
				}
			}
		}
	});

	// wait until discconect or error, then cleanup + save
	tokio::select! {
		_ = (&mut send_task) => tracing::debug!("Send task for client {} finished", client_id),
		_ = (&mut recv_task) => tracing::debug!("Receive task for client {} finished", client_id),
	};

	room.clients.remove(&client_id);
	tracing::info!("Client {} disconnected from note {}", client_id, note_id);

	if room.clients.is_empty() {
		tracing::info!("Last user left room {}. Saving to DB...", note_id);
		
		let doc_lock = room.doc.read().await;
		if let Err(_) = db::save_note(&state.pool, note_id, &doc_lock).await {
			tracing::error!("Failed to save note {} to DB upon closing.", note_id);
		}
		
		state.rooms.remove(&note_id);
	}
}