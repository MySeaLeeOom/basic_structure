# Live Cursors

Live cursors let users see each other's cursor positions and text selections in real time. They use the **Yjs Awareness protocol**, which is separate from the document CRDT sync — cursor data is ephemeral (never persisted to the database) and travels on its own message type (`MSG_AWARENESS = 0x01`).

---

## How it works

### Awareness vs document sync

| | Document sync (`MSG_SYNC`) | Awareness (`MSG_AWARENESS`) |
|---|---|---|
| **What it carries** | Text insertions, deletions, formatting | Cursor position, selection range, user name, color |
| **Persisted?** | Yes — every update saved to `notes.doc_state` and `note_updates` | No — only held in-memory in `DocumentRoom.awareness_states` |
| **Lifetime** | Permanent (survives server restart via Postgres) | Ephemeral (lost when last client disconnects) |
| **Wire tag** | `0x00` | `0x01` |

Both travel over the same WebSocket connection.

### Awareness state contents

Each client's awareness state is a JSON object stored as `state_json` on the backend. The Yjs Awareness protocol and `CollaborationCaret` extension populate it with:

```json
{
  "user": {
    "name": "Anonymous",
    "color": "#958DF1"
  },
  "cursor": {
    "anchor": 42,
    "head": 42
  },
  "selection": {
    "anchor": 42,
    "head": 50
  }
}
```

- **cursor**: The text insertion point (anchor = head means no selection).
- **selection**: The highlighted range (anchor != head means text is selected).
- **user**: Display metadata — shown on the cursor label.

These fields are set automatically by `@tiptap/extension-collaboration-caret` whenever the ProseMirror selection changes.

---

## End-to-end flow

```
CLIENT A (cursor moves)                    BACKEND                         CLIENT B (sees cursor)
═══════════════════════                    ═══════                         ═════════════════════

User moves cursor or
selects text in TipTap
       │
       ▼
CollaborationCaret detects
ProseMirror selection change
       │
       ▼
Updates Yjs Awareness with:
 • cursor position (anchor/head)
 • selection range
 • user info (name, color)
       │
       ▼
awareness.on("update") fires
in WebSocketProvider
       │
       ▼
encodeAwarenessUpdate() from
y-protocols/awareness encodes:
 [client_id (varint)]
 [clock (varint)]
 [state_json (varint + UTF-8)]
       │
       ▼
Provider prepends 0x01 tag
sends: [0x01][encoded]  ──────────►  handle_socket() receives
via WebSocket (binary)               binary message
                                            │
                                            ▼
                                     First byte = 0x01
                                     → decode_awareness_message()
                                       parses varint entries
                                            │
                                            ▼
                                     handle_awareness_update():
                                     • Stores in room.awareness_states
                                       HashMap<client_id, AwarenessState>
                                     • Tracks client_id in
                                       local_awareness_client_ids
                                            │
                                            ▼
                                     broadcast_to_room():
                                     forwards raw bytes to all
                                     clients EXCEPT Client A
                                            │
                                            └──────────────►  WebSocket.onmessage()
                                                              receives binary data
                                                                     │
                                                                     ▼
                                                              Tag = 0x01 → awareness
                                                              applyAwarenessUpdate()
                                                              updates local Awareness
                                                                     │
                                                                     ▼
                                                              CollaborationCaret
                                                              renders cursor DOM:

                                                               ┌────────────┐
                                                               │ Anonymous  │  ← label
                                                               └──────┬─────┘
                                                                      │        ← caret
                                                                      │
                                                              (positioned at the
                                                               cursor's text offset)
```

### On connect

When a new client joins a note, the backend sends existing awareness states so the newcomer immediately sees other users' cursors:

```
New client connects
       │
       ▼
Server: send_initial_state()     ← full document (MSG_SYNC, untagged)
Server: send_initial_awareness() ← all current awareness entries (MSG_AWARENESS)
       │
       ▼
Client applies awareness
       │
       ▼
CollaborationCaret renders
all existing cursors immediately
```

### On disconnect

When a client's WebSocket closes, the backend removes their awareness state and broadcasts a removal message to remaining clients:

```
Client A disconnects
       │
       ▼
Server: removes client from room.clients
Server: removes entries from room.awareness_states
Server: encodes removal entries with clock+1, state_json="null"
Server: broadcasts [0x01][removal] to remaining clients
       │
       ▼
Remaining clients:
applyAwarenessUpdate() processes "null" state
CollaborationCaret removes the cursor from the DOM
```

---

## Awareness wire format

The awareness message format is identical between our backend and `y-protocols/awareness`:

```
[0x01]                             ← tag byte (MSG_AWARENESS)
[num_entries: LEB128 varint]       ← number of awareness entries

for each entry:
  [client_id: LEB128 varint]       ← Yjs client ID
  [clock: LEB128 varint]           ← monotonic counter (incremented on each change)
  [state_json_len: LEB128 varint]  ← byte length of JSON string
  [state_json: UTF-8 bytes]        ← JSON with cursor, selection, user info
```

The LEB128 varint encoding uses 7 data bits per byte, high bit as continuation flag. This is the standard format from `lib0/encoding` used throughout the Yjs ecosystem.

After stripping the `0x01` tag byte, the payload is directly compatible with `applyAwarenessUpdate()` / `encodeAwarenessUpdate()` from `y-protocols/awareness`.

---

## Frontend implementation

### Components involved

| Component / File | Role |
|---|---|
| `NoteEditor.vue` | Configures `CollaborationCaret` with the provider and user info |
| `WebSocketProvider.ts` | Sends/receives awareness messages, exposes `awareness` property |
| `useCollaboration.ts` | Creates the `Awareness` instance, tracks `connectedUsers` count |
| `base.css` | Styles the cursor caret and username label |

### CollaborationCaret configuration

In `NoteEditor.vue`:

```typescript
CollaborationCaret.configure({
  provider: provider,  // must expose .awareness property
  user: { name: "Anonymous", color: "#958DF1" },
})
```

The extension reads `provider.awareness` to access the shared Awareness instance. Our `WebSocketProvider` exposes this as a public readonly property.

### Cursor CSS

The caret and label are rendered as DOM elements by CollaborationCaret. Styled in `base.css`:

```css
/* Vertical line at cursor position */
.collaboration-cursor__caret {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

/* Username label floating above the caret */
.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  left: -1px;
  padding: 0.1rem 0.3rem;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
}
```

The label background color is set dynamically from the user's `color` field in the awareness state.

### Connected users count

`useCollaboration.ts` tracks how many users are connected by listening to awareness changes:

```typescript
awareness.on("change", () => {
  connectedUsers.value = awareness.getStates().size;
});
```

`NoteEditor.vue` displays this when more than one user is present:

```html
<span v-if="editable && connectedUsers > 1">
  {{ connectedUsers }} users editing
</span>
```

---

## Backend implementation

### Data structures

In `sync.rs`:

```rust
pub struct DocumentRoom {
    pub doc: Arc<RwLock<Doc>>,
    pub clients: HashMap<u64, UnboundedSender<Vec<u8>>>,
    pub awareness_states: HashMap<u64, AwarenessState>,
}

pub struct AwarenessState {
    pub clock: u64,
    pub state_json: String,
}
```

`awareness_states` maps each Yjs client ID to its current cursor/presence state. This is separate from `clients` (which maps server-assigned connection IDs to sender channels).

### Message handling

In `websocket.rs`, incoming binary messages are classified by attempting awareness decoding first:

```rust
if let Some(entries) = decode_awareness_message(&payload) {
    handle_awareness_update(&room, client_id, entries, &payload, ...).await;
    continue;
}
// Otherwise: treat as CRDT document update
```

`handle_awareness_update`:
1. Updates `room.awareness_states` for each entry
2. Removes entries where `state_json == "null"` (client departed)
3. Broadcasts the raw payload to all other clients (opaque relay)

### Broadcasting

```rust
async fn broadcast_to_room(room, source_client_id, payload) {
    room.clients.retain(|client_id, sender| {
        if *client_id == source_client_id { return true; }
        sender.send(payload.clone()).is_ok()
    });
}
```

The server never interprets or transforms cursor positions. It stores the awareness state for initial-sync purposes and forwards the raw bytes. Failed sends automatically remove dead clients via `.retain()`.

---

## Key design properties

1. **Ephemeral**: Cursor data is never written to the database. It exists only in `DocumentRoom.awareness_states` while the room is active.

2. **Opaque relay**: The backend doesn't parse cursor positions or user info beyond the varint framing. It stores the JSON string opaquely and forwards raw bytes.

3. **Automatic cleanup**: When a client disconnects, the backend constructs removal entries (`state_json: "null"`) with an incremented clock and broadcasts them. Remaining clients remove the departed cursor from their editors.

4. **Low latency**: Awareness updates skip the persistence path entirely — no database reads or writes. They go directly from decode → store → broadcast.

5. **Single WebSocket**: Cursor awareness and document sync share one connection, distinguished by the tag byte. No extra connections needed for presence.
