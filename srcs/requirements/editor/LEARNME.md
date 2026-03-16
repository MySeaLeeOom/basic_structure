# Editor Service (Real-time Collaboration)

This service manages the real-time collaborative editing sessions for notes using [Yrs](https://github.com/y-crdt/yrs) (Rust port of Yjs) and WebSockets.

## 🧠 Core Concept: CRDTs & Yjs

The editor does not save "text" directly. It saves a **Audit History of Updates** (CRDTs - Conflict-free Replicated Data Types).
- **Yrs (Rust)**: Runs on this server. Holds the "source of truth" document in memory.
- **Yjs (JS)**: Runs on the frontend. Syncs with this server.

When you type in the frontend:
1. Yjs generates a binary "update".
2. Update is sent via WebSocket to this service.
3. This service applies the update to its in-memory `Doc`.
4. This service broadcasts the update to all other connected clients.

## 🔄 Data Architecture

### 1. The WebSocket Connection (`/ws/{note_id}`)
- **Endpoint**: `ws://<host>/ws/<uuid>`
- **Handler**: `src/ws_handler.rs`
- **Logic**:
    - Checks if a `DocumentRoom` exists in memory for this `note_id`.
    - If not, loads the saved state from Postgres (`db::load_note`).
    - Upgrades the connection to a WebSocket.
    - Spawns a dedicated task to handle incoming/outgoing messages for this client.

### 2. In-Memory State (`state.rs`)
- **`AppState`**: Holds a thread-safe map (`DashMap` or `HashMap` with Mutex) of active rooms.
- **`DocumentRoom`**: Represents one open note. Contains:
    - The Yrs `Doc` (the actual CRDT structure).
    - A list of connected subscribers (clients).

### 3. Database Persistence (`db.rs`)
The service interacts with the `note_states` table in Postgres.
- **Loading**: When the first user opens a note, we fetch the `state_vector` (binary blob) from DB and reconstruct the Yrs `Doc`.
- **Saving**: We periodically (or on close) serialize the Yrs `Doc` back into a binary state vector and `UPDATE` the database.

> **Note**: We store the *result* of the merge, not every single keystroke history forever, to keep DB size manageable.

## 🛠️ Tech Stack
- **Language**: Rust
- **Web Framework**: Axum
- **Database**: SQLx (Postgres)
- **CRDT Library**: Yrs/Yjs
- **Async Runtime**: Tokio

## 🚀 Environment Variables
Used to connect to the shared Postgres database:
- `DB_HOST`: Hostname of the postgres container (usually `postgres`)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name (shared with other services)
- `PORT`: Service port (default: 3004)

## 📦 Key Files
- `src/main.rs`: Entry point. Initializes DB pool, logging (tracing), and Router.
- `src/ws_handler.rs`: Manages WebSocket lifecycle (connect, disconnect, message handling).
- `src/db.rs`: SQL queries to load/save the CRDT binary blobs.
- `models.rs`: Structs matching DB tables.

## 🐛 Debugging
Logs are output via `tracing`.
To see detailed logs, set `RUST_LOG=editor=debug`.
```bash
# Check logs in docker
# -f: --follow
docker logs -f editor
```


# 🔬 Deep Dive: Implementation Details

This section breaks down the actual Rust code to help you recreate the service.

## 1. The WebSocket Handshake ( `src/ws_handler.rs` )

The entry point is a standard HTTP GET request. Axum upgrades it to a WebSocket if the headers are correct.

### 1.1 What is a WebSocket?
Normally, the web runs on **HTTP**: the user asks (Request), and the server answers (Response). After the answer, the connection closes.

A **WebSocket** starts as an HTTP Request but says: *"Hey, can we keep this line open and talk freely?"*

If the server agrees, it responds with **101 Switching Protocols**. The connection stays open. Now, both the client and server can send data at any time without asking first. This is called **Full-Duplex** communication.

### 1.2 "Upgrading" the Connection
The "Handshake" is that initial HTTP request to upgrade the protocol. In Axum (our web framework), this is handled by the `WebSocketUpgrade` extractor.

### 1.3 Annotated Code: The "Extractor" Magic
This is the most confusing part of Rust web frameworks (Axum), but also the most powerful. 

You might wonder: *How does declaring a variable check headers?*

The answer is **Dependency Injection**. Axum does not run your function immediately.
1. Axum looks at the type of arguments you asked for (`WebSocketUpgrade`).
2. It runs a hidden pre-check logic associated with that type (checking headers).
3. **If headers are missing**: Axum stops. It returns `400 Bad Request` to the user. Your function **is never called**.
4. **If headers are good**: Axum builds the `ws` object and finally runs your function.

#### Who Calls `ws_route`? (The Trigger)

It is called **milliseconds AFTER the page loads**, when your JavaScript specifically asks to "connect".

**The Sequence:**
1.  **User visits page:** Browser downloads index.html and main.js. (Served by Nginx/Frontend. **Editor Service sleeps**).
2.  **JS starts:** The Vue app initializes in the browser.
3.  **JS executes:** The line `new WebsocketProvider(...)` runs.
4.  **Browser Request:** The browser silently sends a background request to `ws://localhost:3000/ws/123`.
5.  **Server Match:** Axum sees the request to `/ws/...`, matches it to your `.route`, and **NOW** calls `ws_route`.
```rust
// The route definition in main.rs
.route("/ws/{id}", get(ws_handler::ws_route))

// proper handler in ws_handler.rs
pub async fn ws_route(
    // 1. THE GUARD (Extractor)
    // By listing this type, you force Axum to validate the request first.
    // Axum internally calls `WebSocketUpgrade::from_request(req)`.
    // It verifies:
    //   - "Connection: Upgrade"
    //   - "Upgrade: websocket"
    //   - "Sec-WebSocket-Key: <random_key>"
    // Only if ALL exist, this `ws` variable is created.
    ws: WebSocketUpgrade,

    // 2. PATH EXTRACTOR
    // Axum parses the URL "/ws/123e4567..." 
    // and converts the string ID into a Uuid type for you.
    Path(note_id): Path<Uuid>,

    // 3. STATE EXTRACTOR
    // This connects back to `.with_state(app_state)` in main.rs.
    // It retrieves the `state` variable we initialized at startup.
    // This gives us access to the Database Pool and the list of active rooms.
    // Without this, the function would be isolated and unable to save anything.
	// "Dependency injection"
    State(state): State<Arc<AppState>>,
) -> Response {
    // 4. Finalize the handshake. 
    // We return a Response that sends "HTTP 101 Switching Protocols" back to client.
    // AND we provide a callback function (`handle_socket`) that will now run 
    // in a background loop to manage the actual open connection.
    ws.on_upgrade(move |socket| handle_socket(socket, note_id, state))
}
```

### 1.4 Where does the Request come from?
It comes from the **Frontend** (your browser).

In `srcs/requirements/frontend/app/composables/useCollaboration.ts`, we have this TypeScript code:

```typescript
import { WebsocketProvider } from "y-websocket";

// ... inside a function ...
const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${location.host}/ws`; // e.g. "ws://localhost:3000/ws"

// THIS LINE triggers the request!
const newProvider = new WebsocketProvider(wsUrl, id, newYdoc);
```

When this line runs in Chrome/Firefox:
1.  **Our Code calls** `new WebsocketProvider(...)`. This is a helper class from the `y-websocket` library.
2.  **The Library calls** `new WebSocket(url)` internally. This is the official Browser API.
3.  **The Browser itself** automatically constructs an HTTP GET request.
4.  **The Browser itself** adds the `Upgrade: websocket`, `Connection: Upgrade`, and `Sec-WebSocket-Key` headers.
5.  The request flies across the network to your Rust backend.

So, "what puts those headers in there?" -> **The Browser (Chrome/Firefox/Safari)**, following the [RFC 6455](https://tools.ietf.org/html/rfc6455) standard. You don't write them manually.

MDN Documentation: [MDN - WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

### 1.5 WebSocket vs. Streams (Why not use a Stream?)
You might hear about `WebSocketStream` (raw byte streams) or just TCP Streams.

*   **We use `WebSocket` (Message-Based):**
    *   **Concept:** "Here is a full packet."
    *   **Why:** Yjs updates are distinct, self-contained binary blobs. We need the *entire* update to apply it to the document. The WebSocket protocol handles the "framing" (knowing where a message starts and ends) for us.
    *   **Analogy:** Receiving letters. You wait for the postman, he hands you a full envelope. You open it and read it.

*   **When to use a raw Stream:**
    *   **Concept:** "Here is a continuous flow of bytes."
    *   **Why:** If you were streaming live **Audio/Video**, or transferring a massive 10GB file. You would handle the raw bytes yourself to manage buffering (backpressure) precisely.
    *   **Analogy:** A water hose. You just get water, and you have to decide when to stop drinking.

## 2. State Management with DashMap (`src/state.rs`)
We need to share document state across many WebSocket connections (threads).
*   **DashMap**: A concurrent HashMap. High performance, no global lock.
*   **Arcs & RwLocks**: To safely share the Yrs Document and Awareness between threads.

```rust
pub struct DocumentRoom {
    // The "Source of Truth" CRDT document
    pub doc: Arc<RwLock<Doc>>, 
    // Ephemeral state (cursors, selections) - not saved to DB
    pub awareness: Arc<RwLock<Awareness>>,
    // Active connections to broadcast updates to
    pub clients: DashMap<usize, UnboundedSender<Message>>,
}

pub struct AppState {
    pub pool: PgPool,
    // Map: NoteID -> Active Room
    pub rooms: DashMap<Uuid, Arc<DocumentRoom>>,
}
```

## 3. The Sync Loop (`ws_handler.rs` & `sync.rs`)
This is the heartbeat of the service.
1.  **Receive** binary blob from Client A.
2.  **Apply** it to the local `Doc`.
3.  **Broadcast** the *same* blob to Client B, C, D.

```rust
// In handle_socket (ws_handler.rs)
// We spawn a task to listen to this specific client
let mut recv_task = tokio::spawn(async move {
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Binary(bytes) = msg {
            // Apply update to our central Doc
            let response = sync::process_binary_message(&bytes, &room.doc, &room.awareness).await;
            
            // If valid update, broadcast to everyone else
            if let Ok(resp) = response {
                 for client in room.clients.iter() {
                     if *client.key() != my_client_id {
                         client.value().send(resp.clone());
                     }
                 }
            }
        }
    }
});
```

## 4. Persistence Strategy (`ws_handler.rs` & `db.rs`)
We use a **Lazy Loading / Save-on-Close** strategy to minimize DB writes.

*   **Load**: When the *first* user connects, we fetch the blob from Postgres.
*   **Save**: When the *last* user disconnects, we save the blob back.

```rust
// End of handle_socket (ws_handler.rs)
// This runs when the WebSocket connection closes
room.clients.remove(&client_id);

// If the room is empty, no one is editing -> Save and Cleanup
if room.clients.is_empty() {
    let doc_lock = room.doc.read().await;
    // Serialize the entire document state to a byte array
    db::save_note(&state.pool, note_id, &doc_lock).await;
    
    // Remove from memory to save RAM
    state.rooms.remove(&note_id);
}
```

## 5. The Database Schema
Very simple. We store the document as a single binary column. Cracking open the CRDT format in SQL is hard/impossible, so we treat it as a blob.

```sql
CREATE TABLE note_states (
    note_id UUID PRIMARY KEY,
    state_vector BYTEA NOT NULL -- The entire Yjs document history
);
```

## 🧠 Topics for Further Study
To fully master this service, you should look into:
1.  **Yjs Protocol**: How the binary update format works (V1 vs V2).
2.  **Tokio Channels (`mpsc`)**: How we send messages between the WebSocket thread and the broadcast loop.
3.  **Axum Extractors**: How `Path`, `State`, and `ws` are pulled from the request.
4.  **Debouncing Saves**: Currently we save only on disconnect. A robust production app would also save every X seconds (e.g., `tokio::time::interval`) to prevent data loss if the server crashes while users are still connected.
