# WebSocket Notification Channel

Real-time sidebar updates across all tabs and users.

## Problem

The sidebar shows note titles fetched via REST from Postgres. Title edits happen through Yjs/WebSocket and only persist to Postgres when the last user disconnects from a note. This means other tabs and users see stale titles until page reload.

## Solution

A dedicated bidirectional WebSocket on the notes service for real-time sidebar events.

## Endpoints

### REST (notes service — existing)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notes` | Initial load (SSR + client) |
| POST | `/api/notes` | Create note |
| DELETE | `/api/notes/:id` | Delete note |

### WebSocket: Document Editing (editor service — existing)

| Endpoint | Purpose |
|----------|---------|
| `/ws/:noteId` | Yjs CRDT sync for collaborative editing (title + content) |

### WebSocket: Notification Channel (notes service — new)

| Endpoint | Direction | Message |
|----------|-----------|---------|
| `/ws/notifications` | Client → Server | `{ type: "update_title", id, title }` |
| | Server → Client | `{ type: "title_changed", id, title }` |
| | Server → Client | `{ type: "note_created", note }` |
| | Server → Client | `{ type: "note_deleted", id }` |

## Data Flow

### Title edit
```
User types title
  → Yjs syncs to other editors of same note (existing)
  → Frontend debounces (500ms) and sends { update_title, id, title } via notification WS
    → Notes service saves to DB
    → Notes service broadcasts { title_changed, id, title } to all other connected clients
      → Their sidebars update via noteStore.updateNoteTitle()
```

### Create note
```
Frontend calls POST /api/notes (REST)
  → Notes service creates note in DB, responds to caller
  → Notes service broadcasts { note_created, note } via notification WS
    → Other clients add note to their sidebar
```

### Delete note
```
Frontend calls DELETE /api/notes/:id (REST)
  → Notes service deletes from DB, responds to caller
  → Notes service broadcasts { note_deleted, id } via notification WS
    → Other clients remove note from their sidebar
```

### Initial load
```
REST GET /api/notes → populates noteStore
(Required for SSR — WebSocket only works in the browser)
```

## Implementation

### Backend (notes service)

1. **`hub.rs` (new)** — Client registry (`DashMap<ClientId, Sender>`) + broadcast function
2. **`main.rs`** — Add `/ws/notifications` route, shared hub state
3. **`handlers.rs`** — After create/delete mutations, broadcast event via hub
4. **WS handler** — Accept connections, register clients, handle `update_title` messages (save to DB + broadcast)
5. **`Cargo.toml`** — Add WS dependencies if not present

### Frontend (noteStore.ts)

1. Connect to `/ws/notifications` on mount (client-side only)
2. On `title_changed` → `updateNoteTitle(id, title)`
3. On `note_created` → add note to `notes` array
4. On `note_deleted` → remove note from `notes` array
5. Send `update_title` messages (debounced) when title changes in editor

### Nginx

Add proxy rule for `/ws/notifications` → notes service (port 3003), with WebSocket upgrade headers.

## Frontend Store Role

`noteStore.ts` holds reactive state for the sidebar: notes list, selected note, loading/error.

- REST populates it on initial load (SSR)
- `updateNoteTitle(id, title)` updates sidebar instantly (called by NoteEditor when Yjs title changes locally, and by WS handler for remote changes)
- WS notification channel keeps it in sync for cross-user events
