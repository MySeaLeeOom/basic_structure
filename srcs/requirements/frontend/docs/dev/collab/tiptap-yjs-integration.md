# Tiptap + Yjs Frontend Integration

This document describes the frontend integration of Tiptap with Yjs for collaborative rich-text editing. For the backend workflow, see [overview.md](./overview.md). For the WebSocket provider, see [websocket-provider.md](./websocket-provider.md). For the live cursor system, see [live-cursors.md](./live-cursors.md).

---

## Package Dependencies

```jsonc
{
  "dependencies": {
    "@tiptap/vue-3": "^3.20.0",
    "@tiptap/starter-kit": "^3.20.0",
    "@tiptap/extension-collaboration": "^3.20.0",
    "@tiptap/extension-collaboration-caret": "^3.20.0",
    "@tiptap/extension-placeholder": "^3.20.0",
    "yjs": "^13.6.29",
    "y-protocols": "^1.0.7"
  }
}
```

**Not needed:**
- `y-websocket` — we use a custom provider (see [websocket-provider.md](./websocket-provider.md))
- `y-prosemirror` — `@tiptap/extension-collaboration` wraps this internally

---

## Y.XmlFragment vs Y.Text — The Type Constraint

### The problem

Tiptap's `Collaboration` extension requires a `Y.XmlFragment` for its content field. The backend's `POST /api/notes` creates a `Y.Text("content")` field. These are incompatible types.

**Why Tiptap requires XmlFragment:** Tiptap is built on ProseMirror, which models documents as a node tree (paragraphs, headings, list items). Only `Y.XmlFragment` can represent this structure:

```
Y.XmlFragment("content")
├── XmlElement("paragraph")
│   └── XmlText("Hello ")
│   └── XmlText("world", { bold: true })
├── XmlElement("heading", { level: 2 })
│   └── XmlText("Subtitle")
└── XmlElement("paragraph")
    └── XmlText("More text")
```

`Y.Text` is a flat character sequence with no concept of block-level nodes.

### The type-locking rule

A `Y.Doc` locks shared type names on first access:

```typescript
ydoc.getText("content");        // locks "content" as Y.Text
ydoc.getXmlFragment("content"); // THROWS: already defined as Y.Text
```

This applies across the network — types locked by the backend are locked on the frontend too.

### The solution

Let Tiptap use its default field name `"default"` instead of `"content"`:

```
Y.Doc
├── "title"    → Y.Text         ← title input (observe/insert)
├── "content"  → Y.Text         ← seeded by backend POST (unused by Tiptap)
└── "default"  → Y.XmlFragment  ← created by Tiptap Collaboration extension
```

`Collaboration.configure({ document: ydoc })` (without a `field` option) internally calls `ydoc.getXmlFragment("default")`. This avoids any collision with the backend's `"content"` field.

**Trade-off:** Content seeded via `POST /api/notes { content: "..." }` goes into `Y.Text("content")` and won't appear in the editor. Acceptable since we create blank notes.

### Why the title stays as Y.Text

The note title is a single line of plain text — binding it to a Tiptap editor would be overkill. Instead, it uses `Y.Text` directly with `observe()` / `insert()`, giving real-time sync without a second editor instance.

---

## useCollaboration Composable

### What it does

A Vue composable that creates and owns the Yjs collaboration objects, wiring them together and managing their lifecycle:

```
WebSocketProvider          useCollaboration          Vue Components
(binary protocol,    ←──  (creates all three,   ──→  (reactive refs,
 raw Uint8Arrays,          wires them together,       template rendering,
 event callbacks)          manages lifecycle)         user input)
                                 ↕
                              Y.Doc
                          (CRDT state,
                           XmlFragment,
                           Text fields)
```

### Where the Y.Doc lives

```
Browser A                    Backend                     Browser B
┌──────────┐            ┌──────────────┐            ┌──────────┐
│  Y.Doc   │◄──── WS ──►│  yrs Doc     │◄──── WS ──►│  Y.Doc   │
│ (in RAM) │            │ (in RAM +    │            │ (in RAM) │
│          │            │  PostgreSQL) │            │          │
└──────────┘            └──────────────┘            └──────────┘
  JavaScript               Rust (yrs)                JavaScript
  temporary               persistent                 temporary
```

The browser copy is ephemeral — created fresh on mount, populated by the WebSocket sync message, destroyed on unmount. PostgreSQL is the durable source of truth.

### Why a composable instead of a Pinia store

1. **Lifecycle mismatch** — A Pinia store is a singleton that lives for the entire app session. Collaboration state is per-editing-session — created when opening a note, destroyed when closing it. With a composable, `onUnmounted` handles cleanup automatically.

2. **Instance vs singleton** — If the app ever renders two editors (e.g. side-by-side), a store can only hold one Y.Doc. Each composable call returns an independent instance.

3. **SSR safety** — Pinia stores are created during SSR. Y.Doc and WebSocket cannot exist on the server. The composable runs only in client-side components.

4. **CRDT objects aren't serializable** — The old `editStore` held plain strings. Collaboration state holds `Y.Doc`, `Y.Text`, `Awareness` — these can't be part of `window.__INITIAL_STATE__`.

### v-model patterns — who owns the data

With Yjs, the `Y.Doc` is the source of truth, not Vue reactive state:

| Field | v-model? | Source of truth |
|---|---|---|
| Content (Tiptap) | **No** — Tiptap manages its own state via `Y.XmlFragment` | `Y.XmlFragment` in Y.Doc |
| Title (input) | **Yes, but reactive mirror only** — edits go through `yTitle`, not through `v-model` | `Y.Text` in Y.Doc |

Title data flow:
```
User types → updateTitle() → yTitle.delete() + yTitle.insert()
                                    │
                                    ▼
                            Y.Doc "update" event → WebSocket
                                    │
                                    ▼
                            yTitle.observe() → titleText.value = yTitle.toString()
                                    │
                                    ▼
                            v-model updates the <input> display
```

---

## NoteEditor Component

A single component handles both viewing and editing via an `editable` prop. Always connected via WebSocket — even in read-only mode, content is live.

### Extension configuration

- **`immediatelyRender: false`** — Required for SSR safety. Defers DOM access until the component is mounted in the browser.

- **`undoRedo: false`** — Disables StarterKit's built-in undo/redo. In Tiptap v3 this option was renamed from `history`. The `Collaboration` extension provides its own CRDT-aware undo manager that only reverts your changes, not remote edits.

- **`Collaboration.configure({ document: ydoc })`** — Passes the entire Y.Doc. Tiptap internally creates `XmlFragment("default")`, avoiding collision with the backend's `Y.Text("content")`.

- **`CollaborationCaret.configure({ provider })`** — Reads `provider.awareness` for the shared Awareness instance. Our `WebSocketProvider` exposes this as a public readonly property.

- **Editable toggle** — A `watch` on `props.editable` calls `editor.setEditable()` to switch modes without remounting or reconnecting the WebSocket.

### Title handling

Inline in `NoteEditor.vue` rather than a separate component (~5 lines of template):
- **Editable**: `InputText` bound to `titleText` with `updateTitle` on changes
- **Read-only**: `<span>` showing `titleText` or "Untitled"

---

## SSR Safety

The app uses Vue SSR. Yjs and WebSocket are browser-only APIs.

### What breaks without guards

`useCollaboration()` runs in `<script setup>`, which executes during SSR. `new WebSocket(...)` and Tiptap's DOM access crash Node.js.

### Protection: `mounted` ref in NotesView

```typescript
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
```

```vue
<NoteEditor v-if="mounted && noteStore.selectedNote" ... />
```

`onMounted()` only fires in the browser, so `mounted` stays `false` during SSR and Vue never instantiates `NoteEditor` on the server. The guard must be one level up from `NoteEditor` — even with a `v-if` inside the component, the `<script setup>` would already have executed.

### What runs where

| Phase | What happens |
|---|---|
| **SSR (Node.js)** | `GET /api/notes` → render sidebar HTML → serialize Pinia → send to browser |
| **Browser hydration** | Hydrate sidebar → `mounted = true` → mount Tiptap → create Y.Doc → connect WebSocket → editor becomes live |

Pinia state (`notes`, `selectedNote`) crosses the SSR boundary via `window.__INITIAL_STATE__`. The Y.Doc is never serialized — it's created fresh in the browser and populated by the WebSocket sync message.

---

## Known Limitations

1. **Sidebar title staleness** — The sidebar reads `title_preview` from REST. Live Y.Text title changes don't update it until page refresh. Only the sidebar Listbox is affected — the editor always shows the live title.

2. **Content type mismatch** — `POST /api/notes` creates `Y.Text("content")`, Tiptap uses `XmlFragment("default")`. The `"content"` field is effectively unused. Either remove it from the backend or switch to `XmlFragment`.

3. **Anonymous users** — All carets show "Anonymous" with the same color. Needs auth integration.

4. **No offline persistence** — Local edits survive reconnect (in-memory) but are lost if the tab closes while disconnected. Fix: add `y-indexeddb`.
