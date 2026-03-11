# Step 3 — Component Integration (completed)

Detailed record of the component integration decisions from the Tiptap implementation. All changes have been applied.

---

## File changes applied

| File | Action |
|---|---|
| `src/types.ts` | Updated — `Note { id: string, title: string, owner_id: string \| null, created_at, updated_at }` |
| `src/composables/useCollaboration.ts` | Rewritten — y-websocket provider, reactive getter param, pending/current swap pattern |
| `src/components/notes/NoteEditor.vue` | Rewritten — watchEffect-based Editor, always editable, no edit/view toggle |
| `src/views/NotesView.vue` | Simplified — single `<NoteEditor>`, SSR guard, no editMode state |
| `src/stores/noteStore.ts` | Updated — createNote sends `{ title: "Untitled" }`, string IDs |
| `src/collaboration/WebSocketProvider.ts` | Deleted — replaced by y-websocket |
| `src/stores/editStore.ts` | Deleted — replaced by useCollaboration |
| `src/components/notes/NoteEdit.vue` | Deleted — replaced by NoteEditor |
| `src/components/notes/NoteDisplay.vue` | Deleted — replaced by NoteEditor |
| `src/components/notes/NoteCreateForm.vue` | Deleted — unused |

---

## Key architectural decisions

### Single NoteEditor vs separate view/edit components

Tiptap is both editor and renderer — `setEditable(false)` produces rich HTML output. A separate NoteDisplay using REST `content_preview` (plain text) would be strictly worse. Always-connected WebSocket shows live content in both modes.

### useCollaboration as composable (not Pinia store)

- Per-session lifecycle (created on mount, destroyed on unmount)
- CRDT objects (Y.Doc, WebsocketProvider) aren't serializable for SSR
- Multiple instances possible (e.g. side-by-side editors)

### Reactive note switching (watch + pending/current)

`useCollaboration(() => props.noteId)` watches the getter. On change, a new Y.Doc + WebsocketProvider connects in the background. After first sync, old connection is destroyed and new one activated. This prevents blank flash during note switches.

### SSR guard in parent

NoteEditor's `<script setup>` creates WebSocket immediately. Guard must be one level up in NotesView to prevent instantiation during SSR entirely.

---

## Data flow: create note → edit

```
User clicks "+"
  → noteStore.createNote() → POST /api/notes { title: "Untitled" }
  → selectedNote = newNote
  → NoteEditor mounts
    → useCollaboration(noteId)
      → Y.Doc + WebsocketProvider connects to /ws/{id}
      → Server sends initial state via y-sync handshake
      → Editor ready for typing
```

## Data flow: switch notes

```
User clicks different note in sidebar
  → selectedNote changes
  → useCollaboration's watch fires
    → New Y.Doc + provider created (pending)
    → After sync: old destroyed, new activated
    → NoteEditor's watchEffect recreates Tiptap Editor
```

## Data flow: title edit

```
User types in InputText
  → updateTitle(value) → yTitle.delete + insert in transaction
  → Y.Doc update → WebSocket → other clients
  → yTitle.observe() → titleText ref updates → InputText rerenders
```

---

## Known limitations

1. **Sidebar title staleness** — REST-fetched title doesn't update from Y.Text changes
2. **Anonymous users** — All carets show "Anonymous"
3. **No offline persistence** — No IndexedDB layer; edits lost if tab closes while disconnected
