# Tiptap Implementation Plan (completed)

Original 3-step plan for integrating Tiptap with Yjs collaborative editing. All steps have been implemented.

---

## Step 1 — Backend (completed)

- Changed `"content"` field handling for XmlFragment compatibility
- Added WebSocket upgrade headers to Nginx for `/ws/` location

## Step 2 — Frontend plumbing (completed)

- Installed tiptap packages + `y-websocket`
- Created `useCollaboration.ts` composable using y-websocket's `WebsocketProvider`
- WebSocket connects to `/ws/{noteId}` via y-sync v1 standard protocol

## Step 3 — Components (completed)

- Created `NoteEditor.vue` — single unified component (always editable, Tiptap + Collaboration extensions)
- Rewrote `NotesView.vue` — simplified with single `<NoteEditor>`, SSR guard
- Updated `types.ts` — Note interface with UUID id, title, owner_id
- Updated `noteStore.ts` — createNote sends `{ title: "Untitled" }`
- Deleted legacy: `NoteEdit.vue`, `NoteDisplay.vue`, `NoteCreateForm.vue`, `editStore.ts`, custom `WebSocketProvider.ts`

## Key design decisions

- **y-websocket over custom provider**: Backend uses y-sync v1 standard protocol, so y-websocket works out of the box
- **Single NoteEditor**: Replaces separate NoteEdit + NoteDisplay. Tiptap renders rich content in both modes
- **Composable over Pinia store**: Collaboration state is per-session, not app-global
- **Reactive note switching**: `useCollaboration` accepts getter, uses watch + pending/current pattern for seamless switch without blank flash
- **SSR guard in parent**: `mounted` ref in NotesView prevents NoteEditor from instantiating during SSR

See [collab docs](../collab/) for detailed architecture documentation.
