# Tiptap + Yjs Integration — Summary

Quick-reference guide. For detailed design docs, see the [collab/](collab/) directory: [overview](collab/overview.md), [tiptap-yjs-integration](collab/tiptap-yjs-integration.md), [websocket-provider](collab/websocket-provider.md), and [live-cursors](collab/live-cursors.md).

---

## Architecture Overview

Two files make up the collaboration system on the frontend:

| File | Role |
|---|---|
| `src/components/notes/NoteEditor.vue` | UI — Tiptap editor + title input, consumes the composable |
| `src/composables/useCollaboration.ts` | Glue + Transport — accepts a noteId getter; creates Y.Doc and WebsocketProvider (from `y-websocket`); watches for note changes and seamlessly swaps connections after first sync |

### How they connect

Two-tier separation — the composable handles both CRDT logic and transport:

```
UI (NoteEditor)  ←→  Glue + Transport (useCollaboration)  ←→  Server (editor service)
   Vue refs              Y.Doc + WebsocketProvider              y-sync v1 protocol
   template bindings     observe/transact                       standard sync + awareness
```

The `y-websocket` library handles all WebSocket communication internally using the **y-sync v1 standard protocol** — the same protocol our Rust editor service speaks. No custom binary protocol needed.

#### NoteEditor.vue — the UI layer

Pure presentation. Holds no collaboration logic — only destructures the composable's return value and binds it to the template. Always editable (no view/edit toggle).

**What gets rendered:**

```
┌─────────────────────────────────────────────┐
│  Card                                       │
│  ┌───────────────────────────────────────┐  │
│  │ Title area                            │  │
│  │  [title input field]                  │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ Content area                          │  │
│  │                                       │  │
│  │  Rich text editor (bold, headings..)  │  │
│  │                                       │  │
│  │  "3 users editing"                    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

```mermaid
flowchart TD
    subgraph props_layer["Props"]
        prop_noteId["defineProps&lt;{ noteId: string }&gt;#40;#41;"]
    end

    subgraph script["Script — what runs when the component loads"]
        subgraph composable_call["Composable call"]
            call["useCollaboration#40;#40;#41; => props.noteId#41;"]
            destructure["Destructures:<br/>ydoc — shallowRef&lt;Y.Doc&gt;<br/>provider — shallowRef&lt;WebsocketProvider&gt;<br/>titleText — ref&lt;string&gt;<br/>connectedUsers — ref&lt;number&gt;<br/>updateTitle — #40;text: string#41; => void"]
        end

        subgraph editor_setup["Editor setup"]
            editor_ref["const editor = shallowRef&lt;Editor&gt;#40;#41;<br/>starts as undefined"]
            watchEffect["watchEffect#40;onCleanup#41;"]
            guard["if #40;!ydoc.value || !provider.value#41; return<br/>— early exit until both refs are populated"]
            create_editor["new Editor#40;{ extensions: ... }#41;"]
        end

        subgraph extensions["Editor extensions"]
            starter["StarterKit.configure#40;{ undoRedo: false }#41;<br/>bold, italic, headings, lists, code blocks<br/>built-in undo disabled — Collaboration provides CRDT-aware undo"]
            collab_ext["Collaboration.configure#40;{ document: doc }#41;<br/>connects editor to Y.Doc XmlFragment"]
            caret_ext["CollaborationCaret.configure#40;{<br/>  provider: prov,<br/>  user: { name: 'Anonymous', color: '#958DF1' }<br/>}#41;<br/>shows colored cursors for other users"]
        end

        assign["editor.value = ed<br/>— triggers Vue re-render"]
        cleanup["onCleanup#40;#40;#41; => ed.destroy#40;#41;#41;<br/>— destroys old editor when ydoc/provider change"]
    end

    prop_noteId --> call
    call --> destructure
    destructure --> watchEffect
    editor_ref --> watchEffect
    watchEffect --> guard --> create_editor
    create_editor --> starter & collab_ext & caret_ext
    starter --> assign
    collab_ext --> assign
    caret_ext --> assign
    assign --> cleanup

    subgraph template["Template — what the user sees"]
        card["Card pt:root:class='card-document'"]

        subgraph title_slot["#title slot"]
            input["InputText<br/>:model-value=titleText — displays title from Y.Doc<br/>@update:model-value=updateTitle — sends typed title to Y.Doc<br/>placeholder='Title'<br/>fluid"]
        end

        subgraph content_slot["#content slot"]
            flex_col["div.flex.flex-col.gap-4.h-full"]
            editor_content["EditorContent :editor=editor<br/>class='tiptap-editor'<br/>renders nothing until editor is created<br/>then shows the rich text editor"]
            users["span v-if='connectedUsers > 1'<br/>class='text-sm text-gray-500'<br/>hidden when alone, shows '3 users editing' when others are connected"]
        end

        card --> title_slot
        card --> content_slot
        flex_col --> editor_content
        flex_col --> users
    end

    destructure -- "titleText" --> input
    destructure -- "updateTitle" --> input
    destructure -- "connectedUsers" --> users
    assign -- "editor" --> editor_content
```

**How each part syncs collaboratively:**

- **Editor content** — handled automatically by the Collaboration plugin. Unlike the title, you never touch the Y.Doc directly:

```mermaid
flowchart TD
    subgraph when_you_type["When you type in the editor"]
        you["You press a key"]
        pm["ProseMirror processes the keystroke"]
        collab["Collaboration plugin writes the change<br/>into Y.Doc's XmlFragment#40;'default'#41;"]
    end

    you --> pm --> collab --> ydoc

    ydoc["Y.Doc — single source of truth"]

    subgraph when_remote_types["When another user types"]
        remote["Other user types on their machine"]
        remote_collab["Their Collaboration plugin writes to their Y.Doc"]
        transport["y-websocket relays update via y-sync v1"]
        apply["Remote update applied to local Y.Doc<br/>— CRDT merge, no conflicts"]
    end

    remote --> remote_collab --> transport --> apply --> ydoc

    subgraph screen_updates["How the editor updates #40;same for both cases#41;"]
        detect["Collaboration plugin #40;y-prosemirror#41; detects<br/>XmlFragment changed"]
        transaction["Creates a ProseMirror transaction<br/>with the new content"]
        render["Editor re-renders — you see the new text"]
    end

    ydoc --> detect --> transaction --> render

    ydoc --> ws_out["y-websocket sends update to server<br/>— echo prevention handled internally"]

    subgraph cursors["Live cursors #40;CollaborationCaret#41;"]
        caret["CollaborationCaret plugin writes cursor position<br/>to Awareness #40;separate from Y.Doc#41;"]
        awareness_recv["Remote cursor updates arrive via Awareness<br/>→ other users' carets rendered in editor"]
    end

    caret --> ws_out
    awareness_recv -.-> render
```

Compare with the title: for the title, we manually write (`updateTitle`) and manually read (`yTitle.observe`). For editor content, the Collaboration plugin does both automatically. Same Y.Doc, same WebSocket, but the plugin handles the wiring instead of us.

- **Title** — synced manually via `:model-value` / `@update:model-value` (not `v-model`) so every change goes through the Y.Doc:

```mermaid
flowchart TD
    subgraph when_you_type["When you type"]
        you["You press a key in the InputText"]
        emit["InputText fires @update:model-value#40;newText#41;<br/>#40;NOT v-model — one-way binding by design#41;"]
        call_update["Calls updateTitle#40;newText#41;"]

        subgraph updateTitle_fn["updateTitle#40;value#41; in useCollaboration"]
            get_ytext["const yTitle = ydoc.getText#40;'title'#41;"]
            transact["ydoc.transact#40;#40;#41; => {<br/>  yTitle.delete#40;0, yTitle.length#41;<br/>  yTitle.insert#40;0, value#41;<br/>}#41;<br/>— atomic replace of entire title"]
        end
    end

    you --> emit --> call_update --> get_ytext --> transact --> ydoc

    ydoc["Y.Doc — single source of truth<br/>Y.Text#40;'title'#41; stores the title string"]

    subgraph when_remote_types["When another user types"]
        remote["Other user types on their machine"]
        remote_transact["Their updateTitle → ydoc.transact"]
        transport["y-websocket relays update via y-sync v1"]
        apply["CRDT merge applied to local Y.Doc"]
    end

    remote --> remote_transact --> transport --> apply --> ydoc

    subgraph screen_updates["How the screen updates #40;same for both cases#41;"]
        observer["yTitle.observe#40;#41; fires<br/>— registered after first sync in useCollaboration"]
        ref["titleText.value = yTitle.toString#40;#41;"]
        vue["Vue detects ref changed"]
        render[":model-value reads new titleText<br/>— input shows updated text"]
    end

    ydoc --> observer --> ref --> vue --> render

    ydoc --> ws_out["y-websocket sends update to server"]
```

Both paths converge at the Y.Doc. The screen always updates the same way — through the observer, never directly. This is why we don't use `v-model`: it would set `titleText` directly, skipping the Y.Doc entirely, so the change would show on your screen but never reach other users.

- **Connected users indicator** — read-only, uses the Awareness protocol (a lightweight side-channel separate from document content):

```mermaid
flowchart TD
    subgraph someone_opens["When someone opens the note"]
        open["User opens the note"]
        create_provider["useCollaboration creates WebsocketProvider<br/>which creates Awareness internally"]
        announce["y-websocket sends presence automatically on connect"]
    end

    subgraph someone_leaves["When someone closes the note"]
        close["User closes note or disconnects"]
        remove["Their Awareness entry is removed"]
        notify["Other clients notified via y-websocket"]
    end

    open --> create_provider --> announce --> awareness
    close --> remove --> notify --> awareness

    awareness["Awareness — tracks who is connected<br/>separate from Y.Doc content<br/>managed by y-websocket internally"]

    subgraph screen_updates["How the indicator updates"]
        change["awareness.on#40;'change'#41; fires<br/>— registered after first sync in useCollaboration"]
        count["awareness.getStates#40;#41;.size<br/>— counts all connected clients including yourself"]
        ref["connectedUsers.value = count"]
        vue["Vue detects ref changed"]
        show["v-if='connectedUsers > 1'?"]
        hidden["1 or fewer → indicator hidden"]
        visible["2 or more → shows '3 users editing'"]
    end

    awareness --> change --> count --> ref --> vue --> show
    show -- "no" --> hidden
    show -- "yes" --> visible
```

Unlike the title and editor content, the indicator is **read-only** — no user action writes to it. It updates passively whenever someone connects or disconnects.

**Why `shallowRef` for the editor?**

The editor is stored as `const editor = shallowRef<Editor>()`. A beginner might ask: why not a normal `ref`?

- `ref` wraps **everything inside** the object in Vue Proxy objects, all the way down into nested properties. A Tiptap `Editor` is a massive class with hundreds of internal properties (DOM nodes, event handlers, ProseMirror state). Deep-proxying all of that would **break** the editor (its internals don't expect to be proxied) and be **slow** for no benefit.
- `shallowRef` only reacts when you replace `.value` entirely (e.g. `editor.value = newEditor`). It ignores changes inside the object. That's all Vue needs here — to know when the editor instance exists so it can pass it to `<EditorContent>`.

**Rule of thumb:** use `shallowRef` for third-party class instances (editors, maps, charts) that manage their own internal state. Use `ref` for your own simple data.

**Why the editor is created inside `watchEffect` (not immediately):**

The editor needs `ydoc` and `provider` from `useCollaboration`, but those aren't available right away — the WebSocket connection takes time to establish. So the editor **can't** be created at the top level. Instead, `watchEffect` waits for them:

```ts
const editor = shallowRef<Editor>();     // starts as undefined

watchEffect((onCleanup) => {
  const doc = ydoc.value;                // might be undefined at first
  const prov = provider.value;           // might be undefined at first
  if (!doc || !prov) return;             // not ready yet — do nothing

  const ed = new Editor({ ... });        // now we can create the editor
  editor.value = ed;                     // Vue detects this → re-renders template
  onCleanup(() => ed.destroy());         // when noteId changes, destroy old editor
});
```

**Timeline of what happens:**

```
1. Component mounts
   → editor is undefined
   → <EditorContent> renders nothing (blank)

2. watchEffect runs, but ydoc/provider are still undefined
   → early return, still no editor

3. WebSocket connects, useCollaboration provides ydoc + provider
   → watchEffect re-runs automatically (Vue tracks the refs it reads)
   → creates the Editor with collaboration plugins
   → editor.value = ed → Vue re-renders → <EditorContent> shows the editor

4. User switches to a different note (noteId changes)
   → useCollaboration gives new ydoc/provider
   → onCleanup fires → old editor is destroyed
   → watchEffect re-runs → new editor is created for the new note
```

**Why `editor` needs to be a ref at all:**

The template has `<EditorContent :editor="editor" />`. Vue needs to know when `editor` goes from `undefined` to an actual instance so it can re-render. A plain `let editor` variable wouldn't trigger a re-render — Vue only tracks refs.

**Editor plugins:**

| Plugin | What it does |
|---|---|
| StarterKit | Basic formatting — bold, italic, headings, lists, code blocks. Built-in undo/redo is disabled (`undoRedo: false`) because Collaboration provides its own CRDT-aware undo that only reverts *your* changes, not remote edits. |
| Collaboration | Connects the editor to the Y.Doc so edits sync across users |
| CollaborationCaret | Shows colored cursors where other users are typing |

**Lifecycle — what happens when a user interacts:**

1. Parent renders `<NoteEditor :note-id="selectedNote.id" />` (no `:key` — stays mounted)
2. `useCollaboration(() => noteId)` calls `setup(noteId)` — creates Y.Doc, WebsocketProvider, connects via WebSocket
3. y-websocket performs y-sync v1 handshake → composable receives `"sync"` event → activates `ydoc`/`provider` refs
4. `watchEffect` in NoteEditor detects new refs → creates Tiptap editor → content displayed
5. User types → keystrokes go into the Y.Doc → y-websocket sends them to server → server sends them to everyone else → their editors update in real time
6. User clicks a different note → `noteId` prop changes → composable's `watch` fires → new connection created, waits for sync → old connection torn down, new editor swapped in seamlessly

#### useCollaboration(() => noteId) — the glue layer

Accepts a reactive getter for the noteId. Creates and owns all CRDT objects, wires Yjs events to Vue refs, and manages lifecycle — including seamless note switching. Uses `y-websocket`'s `WebsocketProvider` for transport.

**Reactive note switching — the pending/current pattern:**

When the noteId changes, the composable doesn't tear down immediately. Instead it:
1. Creates a **pending** Y.Doc + WebsocketProvider and connects
2. Waits for the **`"sync"` event** from y-websocket (server's initial state received)
3. Only then tears down the **old** connection and activates the new one

This keeps the old editor visible during the transition — no blank flash while the new note loads.

```mermaid
flowchart TB
    subgraph useCollab["useCollaboration#40;#40;#41; => noteId#41;"]
        watchNode["watch#40;noteId, setup, immediate#41;"]

        subgraph setup["setup#40;id#41;"]
            cancel["Cancel any pending connection"]
            create["new Y.Doc + Y.Text#40;'title'#41;"]
            connect["new WebsocketProvider#40;wsUrl, id, doc#41;<br/>— connects automatically"]
            listen["provider.on#40;'sync'#41;: wait for isSynced=true"]
        end

        subgraph onFirstSync["On first sync event"]
            teardown["Tear down old: destroy provider + doc"]
            activate["Activate new: set currentYdoc, currentProvider"]
            observe["Wire observers:<br/>yTitle.observe → titleText<br/>awareness.on change → connectedUsers"]
        end

        titleBridge["titleText ref"]
        usersBridge["connectedUsers ref"]
    end

    watchNode --> cancel
    cancel --> create --> connect --> listen
    listen -- "sync event fires with isSynced=true" --> teardown --> activate --> observe
    observe --> titleBridge
    observe --> usersBridge
```

- `watch → setup`: Fires immediately and whenever `noteId()` returns a different value. Replaces the old `:key` remount pattern.
- `cancel`: If the user clicks three notes quickly (A→B→C), the pending B connection is torn down before it ever reaches the editor.
- `listen → onFirstSync`: The composable listens for y-websocket's `"sync"` event, which fires when the y-sync v1 handshake completes and the server's full document state has been applied.
- `teardown → activate`: The old `currentProvider` is destroyed and old `currentYdoc` is destroyed. Then the new ones are assigned to the exposed `shallowRef`s, which triggers the `watchEffect` in NoteEditor to create a new Tiptap editor.
- `observe → bridges`: Title and connected-users observers are wired only after sync, ensuring `titleText` shows the real title (not empty string).

#### WebSocket Protocol — y-sync v1 (standard)

The frontend uses `y-websocket`'s `WebsocketProvider` which speaks the **y-sync v1 standard protocol**. The backend editor service uses the Rust `y-sync` crate which speaks the same protocol. No custom binary framing needed.

**Connection flow (handled by y-websocket internally):**

```mermaid
sequenceDiagram
    participant C as Client (y-websocket)
    participant S as Server (editor service)

    C->>S: WebSocket opens at /ws/{noteId}
    S->>C: SyncStep1 or SyncStep2 (initial state)
    C->>S: SyncStep1 (request state)
    S->>C: SyncStep2 (full document state)
    C->>S: SyncStep2 (client state for reconciliation)

    Note over C,S: y-websocket emits "sync" event

    loop Editing
        C->>S: Update messages (edits)
        S->>C: Update messages (remote edits)
        C->>S: Awareness updates (cursor position)
        S->>C: Awareness updates (remote cursors)
    end
```

**Key differences from the old custom protocol:**
- No manual tag bytes (0x00/0x01) — y-sync v1 handles message framing
- No raw first-message detection — y-websocket manages the sync handshake
- No manual echo prevention — y-websocket tracks origins internally
- Reconnection with exponential backoff is built into y-websocket

**WebSocket URL:** `ws://host/ws/{noteId}` (routed by nginx to the editor service on port 3004)

#### Full wiring — both layers together

```mermaid
flowchart TB
    subgraph NoteEditor["NoteEditor.vue"]
        call["useCollaboration#40;#40;#41; => noteId#41;"]
        tiptap["Tiptap Editor"]
        title["Title Input"]
        indicator["connectedUsers"]
    end

    subgraph useCollab["useCollaboration#40;#40;#41; => noteId#41;"]
        ydoc["Y.Doc"]
        ytext["Y.Text 'title'"]
        provider_create["WebsocketProvider#40;wsUrl, id, doc#41;<br/>— manages Awareness internally"]
        titleBridge["titleText ref"]
        usersBridge["connectedUsers ref"]
    end

    backend["Backend #40;editor service#41;<br/>yrs Doc + PostgreSQL<br/>y-sync v1 protocol"]

    call --> ydoc
    ydoc --> ytext
    ydoc --> provider_create

    ydoc -- "ydoc" --> tiptap
    provider_create -- "provider" --> tiptap
    ytext --> titleBridge
    provider_create -- "awareness" --> usersBridge
    titleBridge -- "titleText" --> title
    usersBridge -- "connectedUsers" --> indicator

    provider_create -- "WS /ws/{noteId}" --> backend
    backend -- "WS y-sync v1" --> provider_create
```

### Lifecycle

```mermaid
sequenceDiagram
    participant Vue as NotesView
    participant NE as NoteEditor
    participant Collab as useCollaboration
    participant YWS as y-websocket
    participant Server as Editor Service

    Note over Vue: user selects first note

    Vue->>NE: mount (no :key — stays mounted)
    NE->>Collab: useCollaboration(() => noteId)
    Collab->>Collab: watch fires → setup(noteId)
    Collab->>Collab: new Y.Doc + Y.Text("title")
    Collab->>YWS: new WebsocketProvider(wsUrl, noteId, doc)
    YWS->>Server: WebSocket opens, y-sync v1 handshake
    Server->>YWS: SyncStep2 (full document state)
    YWS->>Collab: "sync" event fires
    Collab->>Collab: activate refs
    Collab->>NE: ydoc + provider refs populated
    NE->>NE: watchEffect → new Editor created

    Note over Vue: user switches note

    Vue->>NE: noteId prop changes (no remount)
    NE->>Collab: watch fires → setup(newNoteId)
    Collab->>YWS: new WebsocketProvider for new note
    YWS->>Server: new WebSocket opens, y-sync v1 handshake
    Server->>YWS: SyncStep2 (new note state)
    YWS->>Collab: "sync" event fires
    Collab->>Collab: tear down old, activate new refs
    Collab->>NE: ydoc + provider refs updated
    NE->>NE: watchEffect → onCleanup destroys old editor, new editor created
```

---

## Data Flow

### Local Edit

```mermaid
sequenceDiagram
    participant User
    participant Tiptap as Tiptap / ProseMirror
    participant YDoc as Y.Doc
    participant YWS as y-websocket
    participant Server as Editor Service
    participant Remote as Other Clients

    User->>Tiptap: keystroke
    Tiptap->>YDoc: y-prosemirror → Y.Doc update
    Note over Tiptap: editor re-renders<br/>immediately (optimistic)
    YDoc->>YWS: doc update event fires
    YWS->>Server: y-sync v1 update message
    Server->>Server: persist to PostgreSQL
    Server->>Remote: broadcast to other clients
    Remote->>Remote: Y.applyUpdate → Tiptap re-renders
```

### Remote Edit

```mermaid
sequenceDiagram
    participant Remote as Other Client
    participant Server as Editor Service
    participant YWS as y-websocket
    participant YDoc as Y.Doc
    participant Collab as useCollaboration
    participant Tiptap as Tiptap / ProseMirror

    Remote->>Server: y-sync v1 update message
    Server->>YWS: update via WebSocket
    YWS->>YDoc: applies update to local Y.Doc
    YDoc->>Tiptap: XmlFragment updated → editor re-renders
    YDoc->>Collab: yTitle.observe() fires
    Collab->>Collab: titleText ref updates
```

### Create New Note

```mermaid
flowchart TD
    A["User clicks '+'"] --> B["noteStore.createNote()"]
    B --> C["POST /api/notes with { title: 'Untitled' }"]
    C --> D["notes.push(newNote)"]
    D --> E["selectedNote = newNote"]
    E --> F["NoteEditor receives new noteId"]
    F --> G["useCollaboration watch fires → setup(uuid)"]
    G --> H["new Y.Doc + WebsocketProvider"]
    H --> I["WS connects → y-sync handshake → sync event → editor ready"]
```

### Open Existing Note

```mermaid
flowchart TD
    A["Click note in sidebar"] --> B["selectedNote = note"]
    B --> C["NoteEditor receives noteId"]
    C --> D["useCollaboration watch fires → setup(uuid)"]
    D --> E["new Y.Doc + WebsocketProvider → y-sync handshake"]
    E --> F["Sync event received → refs activated"]
    F --> G["yTitle observe → titleText = 'Meeting Notes'"]
    F --> H["XmlFragment populated → editor renders rich content"]
```

### Switch Notes (seamless swap)

```mermaid
flowchart TD
    A["Click different note"] --> B["noteId prop changes"]
    B --> C["useCollaboration watch fires → setup(newId)"]
    C --> D["New Y.Doc + WebsocketProvider created, connects to server"]
    D --> E["Sync event received"]
    E --> F["Old provider.destroy() → old WS closes"]
    E --> G["Old ydoc.destroy() → shared types freed"]
    E --> H["New refs activated → watchEffect creates new editor"]
    H --> I["Old editor destroyed by onCleanup"]
```

---

## Backend Architecture (hybrid-notes)

The backend is split into two services:

| Service | Port | Role |
|---|---|---|
| **notes** | 3003 | REST API — CRUD for note metadata (title, owner_id, timestamps) |
| **editor** | 3004 | WebSocket — real-time collaborative editing via y-sync v1 |

Nginx routes:
- `/api/notes/*` → notes service (REST)
- `/ws/*` → editor service (WebSocket)

Both services share the same PostgreSQL database:
- `notes` table — metadata (managed by notes service)
- `note_states` table — CRDT document state (managed by editor service)

---

## Known Limitations

1. **Sidebar title staleness** — sidebar reads `title` from REST; live Y.Text title changes don't update it until page refresh
2. **Content seeding mismatch** — POST body goes to `Y.Text("content")`, Tiptap uses `XmlFragment("default")`. Moot since we create blank notes.
3. **Anonymous users** — all carets show "Anonymous" with same color. Needs auth integration.
4. **No offline persistence** — local edits survive reconnect (in-memory) but are lost if tab closes while disconnected. Fix: add `y-indexeddb`.
