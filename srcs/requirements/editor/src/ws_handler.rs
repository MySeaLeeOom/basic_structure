use axum::{
	extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, State},
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
) -> Response {
	// looks pretty cool, right? Axum takes the WebSocketUpgrade and we call .on_upgrade with our async handler function. Axum will take care of the rest (handshakes, etc.)
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
				let new_room = Arc::new(DocumentRoom::new(doc));
				state.rooms.insert(note_id, new_room.clone());
				new_room
			}
			Err(_) => {
				eprintln!("Failed to load document {}", note_id);
				return;
			}
		}
	};

	// register client
	let client_id = NEXT_CLIENT_ID.fetch_add(1, Ordering::Relaxed);

	// channel: tx to receive messages from other clients, rx to send messages to this client. Pipe tx -> rx.
	let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
	room.clients.insert(client_id, tx.clone());

	// and another channel: sender to send messages to others, receiver to receive messages from this client
	let (mut sender, mut receiver) = socket.split();

	// send state vector and awareness info to the new client
	let init_sync = sync::generate_initial_sync(&room.doc).await;
	let _ = sender.send(Message::Binary(init_sync.into())).await;

	let init_awareness = sync::generate_initial_awareness(&room.awareness).await;
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
		while let Some(Ok(Message::Binary(bytes))) = receiver.next().await {
			
			// give raw bytes to the sync logic. If we get a response (OK + non empty), we broadcast it.
			if let Ok(response_bytes) = sync::process_binary_message(&bytes, &room_clone.doc, &room_clone.awareness).await {

				if !response_bytes.is_empty() {
					let broadcast_msg = Message::Binary(response_bytes.into());
					
					for client in room_clone.clients.iter() {
						if *client.key() != client_id {
							let _ = client.value().send(broadcast_msg.clone());
						}
					}
				}
			}
		}
	});

	// wait until discconect or error, then cleanup + save
	tokio::select! {
		_ = (&mut send_task) => recv_task.abort(),
		_ = (&mut recv_task) => send_task.abort(),
	};

	room.clients.remove(&client_id);

	if room.clients.is_empty() {
		println!("Last user left room {}. Saving to DB...", note_id);
		
		let doc_lock = room.doc.read().await;
		if let Err(_) = db::save_note(&state.pool, note_id, &doc_lock).await {
			eprintln!("Failed to save note {} to DB upon closing.", note_id);
		}
		
		state.rooms.remove(&note_id);
	}
}