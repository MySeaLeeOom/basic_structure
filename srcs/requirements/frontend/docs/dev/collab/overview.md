## The collaborative editing workflow

Every collaborative editing session follows the same path: **connect → load → sync → edit → persist → disconnect**. The number of users and whether the note is new or existing only affect branching conditions within this single flow, never the overall structure.

The backend is a Rust service (Axum + yrs) that handles both REST lifecycle operations and real-time CRDT synchronization over WebSocket. yrs is the Rust port of Yjs.

### Connect

A client opens a WebSocket to the notes service at `/api/notes/{id}/sync`. Axum upgrades the HTTP connection and hands it to `handle_socket`. The handler looks up the note's document room in the in-memory `AppState.rooms` map. If a room already exists (another user is editing), the client joins it directly. If not, a new room is created by loading the document from PostgreSQL (see Load).

Each client gets a unique `client_id` (an incrementing `AtomicU64`) and an unbounded mpsc channel for outbound messages. A dedicated writer task drains this channel and forwards messages over the WebSocket.

```
Browser  ──  WS upgrade  ──▶  Axum ws_sync handler
                                   │
                           get_or_create_room()
                              ╱           ╲
                     room exists?      load from DB
                         │                 │
                         ▼                 ▼
                     join room ◀── create DocumentRoom
                         │
                  insert client_id + tx
                         │
                  send initial state
                  send initial awareness
```

### Load

Loading only happens when the first client connects to a note (no existing room). `load_note_doc` reads the `doc_state` column (a `BYTEA` blob) from the `notes` table and reconstructs a yrs `Doc` by decoding and applying the stored update. This `Doc` becomes the room's in-memory truth.

If the note was created via the REST `POST /api/notes` endpoint, `doc_state` already contains a valid yrs document with two `Y.Text` fields (`"title"` and `"content"`) initialized from the creation payload. The schema enforces `doc_state BYTEA NOT NULL`, so there is no empty-state branch — every note always has a valid CRDT state from the moment it is created.

### Sync

Once the room is ready, the server sends two messages to the new client:

1. **Full document state** — the in-memory `Doc` encoded as a Yjs v1 state update (`encode_state_as_update_v1` against an empty `StateVector`). This gives the client the complete document regardless of what it already has.

2. **Current awareness state** — if other clients are connected, their awareness entries (cursor positions, selections, user info) are encoded and sent as a single awareness message.

The client applies the incoming state update to its local `Doc`, which brings its editor up to date. From this point, both sides are synchronized and incremental editing begins.

### Edit

Each edit produces a Yjs update — a small binary diff describing the change. The client sends this over the WebSocket as a binary message.

On the server, the message is classified by its tag byte:

- **`0x00` (MSG_SYNC)** — CRDT document update. The server strips the tag byte, validates the payload as a valid Yjs v1 update, then:
  1. Persists the update to PostgreSQL (see Persist).
  2. Applies the update to the in-memory `Doc`.
  3. Broadcasts the raw message to all other connected clients.

- **`0x01` (MSG_AWARENESS)** — Presence update. The payload contains varint-encoded entries, each with a `client_id`, `clock`, and `state_json`. The server updates the room's `awareness_states` map and broadcasts the raw message to all other clients. Awareness does not touch the document or the database.

If two users type at the same position simultaneously, yrs's YATA algorithm (inherited from Yjs) deterministically orders the operations using client IDs and logical timestamps. No locking or server-side conflict resolution code is needed.

```
Client A                    Server                    Client B
   │                           │                           │
   │── binary update ─────────▶│                           │
   │                    persist to DB                      │
   │                    apply to Doc                       │
   │                           │── broadcast ─────────────▶│
   │                           │                    apply to Doc
   │                           │                           │
   │                           │◀───── binary update ──────│
   │                    persist to DB                      │
   │                    apply to Doc                       │
   │◀──── broadcast ───────────│                           │
   │  apply to Doc             │                           │
```

### Persist

Persistence is **synchronous per update** — there is no debounce timer. Every incoming CRDT update triggers `persist_note_update`, which:

1. Reads the current `doc_state` from PostgreSQL.
2. Creates a temporary `Doc`, applies the existing state, then applies the incoming update.
3. Encodes the merged state as a new full snapshot.
4. In a single database transaction:
   - Updates `notes.doc_state` with the merged snapshot and bumps `updated_at`.
   - Appends the raw incremental update to the `note_updates` table (an append-only history log).

This means the `notes.doc_state` column always holds the fully merged CRDT state, and `note_updates` preserves every individual edit for auditing or replay.

The database schema:

```sql
notes
├── id              UUID PRIMARY KEY
├── doc_state       BYTEA NOT NULL        -- full yrs document state
├── created_at      TIMESTAMPTZ
├── updated_at      TIMESTAMPTZ
├── owner_id        UUID                  -- for future auth integration
├── title_preview   VARCHAR(255)          -- denormalized for listing/search
└── content_preview TEXT                  -- denormalized for listing/search

note_updates
├── id              BIGSERIAL PRIMARY KEY
├── note_id         UUID → notes(id)
├── update_data     BYTEA NOT NULL        -- individual yrs update
├── created_at      TIMESTAMPTZ
└── client_id       UUID                  -- which client sent this

client_sync_state
├── client_id       UUID  ┐
├── note_id         UUID  ┘ PRIMARY KEY
├── last_update_id  BIGINT
└── updated_at      TIMESTAMPTZ
```

### Disconnect

When a client's WebSocket closes (tab closed, navigation, network loss), the server:

1. Removes the client's sender channel from the room's `clients` map.
2. If the client had any awareness entries, increments their clock and broadcasts a removal message (state `"null"`) to remaining clients so their UIs can remove the departed cursor.
3. If other clients remain, nothing else changes — the in-memory `Doc` stays live and editing continues.
4. If this was the last client, the room is removed from `AppState.rooms`. The document now exists only in PostgreSQL. The next WebSocket connection to this note starts the workflow over from the load phase.

There is no "final persist" on disconnect because every update is already persisted immediately when it arrives. No data is lost when the last client leaves.

### What the REST API does

The REST endpoints handle note lifecycle, not collaborative editing:

| Endpoint | Purpose |
|---|---|
| `GET /api/notes` | List all notes (returns `NoteSummary` — id, previews, timestamps) |
| `GET /api/notes/{id}` | Get a single note (includes `doc_state` binary) |
| `POST /api/notes` | Create a note — builds an initial yrs `Doc` with `"title"` and `"content"` Y.Text fields |
| `DELETE /api/notes/{id}` | Delete a note |

There is no `PUT` endpoint. All document modifications happen exclusively through the WebSocket sync channel.

### Current gaps

- **Frontend WebSocket client**: The frontend does not yet connect to `/api/notes/{id}/sync`. It still uses REST `fetch()` calls. A Yjs client library (e.g. `yjs` + `y-websocket` or a custom binary WebSocket client) needs to be integrated.
- **Rich text editor**: The frontend uses plain `<Textarea>` / `<InputText>` components. A CRDT-aware editor (Tiptap, ProseMirror + y-prosemirror, CodeMirror, or similar) is needed to translate keystrokes into Yjs operations.
- **Authentication on WebSocket**: The `ws_sync` handler accepts connections without any auth check. The gateway's OAuth2 flow is not wired into the WebSocket endpoint.
- **Nginx WebSocket proxy**: The `/api/notes` location block in nginx does not include `Upgrade` / `Connection` headers, so WebSocket connections to `/api/notes/{id}/sync` will fail through the reverse proxy. This needs to be fixed.
- **Preview sync**: `title_preview` and `content_preview` are only set at creation time. They are not updated when the document changes via WebSocket. A mechanism to extract text from the yrs `Doc` and update these columns periodically is needed.
