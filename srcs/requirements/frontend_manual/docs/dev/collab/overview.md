## The collaborative editing workflow

Every collaborative editing session follows the same path: **connect → load → sync → edit → persist → disconnect**.

The backend is split into two services:
- **notes** (Rust/Axum, port 3003) — REST API for note lifecycle (CRUD)
- **editor** (Rust/Axum, port 3004) — WebSocket service for real-time CRDT sync via y-sync v1 protocol

Both share a single PostgreSQL database. yrs is the Rust port of Yjs.

### Connect

A client opens a WebSocket to the editor service at `/ws/{id}` (proxied by nginx). The handler looks up the note's document room in the in-memory rooms map. If a room exists (another user is editing), the client joins it. If not, a new room is created by loading the document from PostgreSQL.

### Load

Loading only happens when the first client connects to a note. The `doc_state` column (`BYTEA`) from the `notes` table is decoded into a yrs `Doc`, which becomes the room's in-memory truth.

### Sync

The editor service uses the **y-sync v1 standard protocol** (same as y-websocket). On connect:
1. Server and client exchange state vectors and missing updates via the standard SyncStep1/SyncStep2 handshake
2. If other clients are connected, their awareness entries are sent

The frontend uses `y-websocket`'s `WebsocketProvider`, which speaks the same protocol natively.

### Edit

Each edit produces a Yjs update (binary diff). Updates flow through the y-sync protocol — the server applies them to the in-memory Doc, persists to PostgreSQL, and broadcasts to other clients.

Awareness updates (cursor positions, selections) are ephemeral — they skip persistence and go directly from decode → store → broadcast.

### Persist

Every incoming CRDT update is persisted synchronously:
1. Reads current `doc_state` from PostgreSQL
2. Merges the incoming update into a new full snapshot
3. In a single transaction: updates `notes.doc_state` and appends to `note_updates` history

### Disconnect

When a client disconnects:
1. Client removed from room
2. Awareness removal broadcast to remaining clients
3. If last client, room removed from memory (document lives only in PostgreSQL)

No "final persist" needed — every update is already persisted immediately.

### REST API (notes service)

| Endpoint | Purpose |
|---|---|
| `GET /api/notes` | List all notes (id, title, timestamps) |
| `GET /api/notes/{id}` | Get a single note |
| `POST /api/notes` | Create a note with initial title |
| `DELETE /api/notes/{id}` | Delete a note |

No `PUT` endpoint — all document modifications happen through WebSocket.

### Current gaps

- **Authentication on WebSocket**: No auth check on WebSocket connections
- **Preview sync**: Sidebar title only updates on page refresh (Y.Text changes don't propagate to REST responses)
- **Anonymous users**: All carets show "Anonymous" with the same color
