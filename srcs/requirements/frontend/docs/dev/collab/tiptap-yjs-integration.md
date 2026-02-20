# Tiptap + Yjs Frontend Integration

This document describes how to integrate Tiptap as a collaborative rich-text editor on the frontend, replacing the current `<Textarea>` / `<InputText>` approach. It connects to the backend WebSocket protocol described in [The collaborative editing workflow](./overview.md).

---

## Table of Contents

1. [Package Dependencies](#1-package-dependencies)
2. [Y.XmlFragment vs Y.Text — The Type Constraint](#2-yxmlfragment-vs-ytext--the-type-constraint)
3. [Custom WebSocket Provider](#3-custom-websocket-provider)
4. [useCollaboration Composable](#4-usecollaboration-composable)
5. [Tiptap Editor Components](#5-tiptap-editor-components)
6. [Store Changes](#6-store-changes)
7. [Component Changes](#7-component-changes)
8. [SSR Safety](#8-ssr-safety)
9. [End-to-End Flow](#9-end-to-end-flow)

---

## 1. Package Dependencies

Add to `package.json`:

```jsonc
{
  "dependencies": {
    // Tiptap core + Vue 3 binding
    "@tiptap/vue-3": "^2.x",
    "@tiptap/pm": "^2.x",               // ProseMirror peer dependency
    "@tiptap/starter-kit": "^2.x",      // Bold, Italic, Heading, etc.

    // Collaboration extensions
    "@tiptap/extension-collaboration": "^2.x",      // Binds Y.XmlFragment to Tiptap
    "@tiptap/extension-collaboration-caret": "^2.x", // Remote cursor/caret rendering

    // Yjs CRDT library
    "yjs": "^13.x",

    // Optional: additional Tiptap extensions as needed
    "@tiptap/extension-placeholder": "^2.x"
  }
}
```

**Packages NOT needed:**

- `y-websocket` — we write a custom provider (see section 3) because the backend uses a simplified binary protocol, not the standard y-websocket sync-step1/step2 handshake.
- `y-prosemirror` — `@tiptap/extension-collaboration` wraps this internally.
- `vue-codemirror` / `codemirror` — can be removed once Tiptap replaces CodeMirror entirely.

Install with:

```bash
pnpm add @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-collaboration @tiptap/extension-collaboration-caret \
  @tiptap/extension-placeholder yjs
```

---

## 2. Y.XmlFragment vs Y.Text — The Type Constraint

### The problem

The backend workflow doc says the REST `POST /api/notes` endpoint creates a yrs `Doc` with two **`Y.Text`** fields (`"title"` and `"content"`). But Tiptap's collaboration extension requires a **`Y.XmlFragment`** for its content field.

#### Why Tiptap requires XmlFragment (verified from Tiptap docs)

The `Collaboration` extension accepts content in two ways, and both resolve to `Y.XmlFragment`:

```javascript
// Option 1: pass a raw XmlFragment
Collaboration.configure({
  fragment: ydoc.getXmlFragment("content"),
})

// Option 2: pass a doc + field name — internally calls getXmlFragment(field)
Collaboration.configure({
  document: ydoc,
  field: "content",  // resolves to ydoc.getXmlFragment("content")
})
```

There is no `Y.Text` option. Tiptap is built on ProseMirror, which models documents as a **node tree** (paragraphs, headings, list items — each a node with children). Only `Y.XmlFragment` can represent this structure:

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

`Y.Text` is a flat character sequence — it has no concept of block-level nodes, so ProseMirror cannot use it.

Source: [Tiptap Collaboration extension docs](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/extensions/functionality/collaboration.mdx), [Naming documents guide](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/guides/naming-documents.mdx)

#### The type-locking rule

A `Y.Doc` is a container of **named shared types**. The first call with a given name locks the type permanently:

```typescript
const ydoc = new Y.Doc();
ydoc.getText("content");        // locks "content" as Y.Text
ydoc.getXmlFragment("content"); // THROWS: already defined as Y.Text
```

This applies across the network. When the backend creates the document and the frontend receives the binary state via WebSocket, the types are already locked. If the backend used `get_or_insert_text("content")` and the frontend calls `getXmlFragment("content")`, Yjs throws:

```
Error: Type with the name "content" has already been defined with a different constructor
```

#### Y.Text vs Y.XmlFragment comparison

| | Y.Text | Y.XmlFragment |
|---|---|---|
| **What it stores** | Flat character sequence with optional inline attributes | Tree of XML-like elements (paragraphs, headings, etc.) |
| **Internal structure** | Linked list of character items | Nested nodes containing XmlElements and XmlText |
| **Who uses it** | CodeMirror, plain `<textarea>`, single-line inputs | ProseMirror / Tiptap (any block-structured editor) |
| **Wire format** | Compatible only with Y.Text on the other side | Compatible only with Y.XmlFragment on the other side |
| **Can represent blocks?** | No — no paragraphs, headings, lists | Yes — full document tree |

### The solution

The backend must create the `"content"` field as a `Y.XmlFragment` (or, in yrs terms, `XmlFragmentRef`). The `"title"` field can remain `Y.Text` since it is a single-line string.

**Backend change needed** (in the Rust notes service):

```rust
// Before (current):
let title_ref = doc.get_or_insert_text("title");
let content_ref = doc.get_or_insert_text("content");

// After (required for Tiptap):
let title_ref = doc.get_or_insert_text("title");          // stays Y.Text
let content_ref = doc.get_or_insert_xml_fragment("content"); // changes to XmlFragment
```

**Frontend binding**:

```typescript
const ydoc = new Y.Doc();
const yTitle   = ydoc.getText("title");              // Y.Text — for the title input
const yContent = ydoc.getXmlFragment("content");     // Y.XmlFragment — for Tiptap
```

### Why the title stays as Y.Text

Tiptap needs a document tree (XmlFragment), but the note title is a single line of plain text. Binding it to a second Tiptap instance would be overkill. Instead, the title uses `Y.Text` directly:

- Observe changes with `yTitle.observe()` to update a reactive `ref`.
- Push local edits with `yTitle.delete()` / `yTitle.insert()` inside a transaction.

This gives the title real-time sync without the overhead of a second rich-text editor.

---

## 3. Custom WebSocket Provider

### Why not y-websocket?

The standard `y-websocket` library (`WebsocketProvider`) implements the **y-protocols sync protocol**, which uses a bidirectional state-vector negotiation handshake. Our backend (`origin/crdts` branch) uses a **simpler custom protocol**. The two are wire-incompatible — plugging `y-websocket` into our backend would corrupt data.

#### y-websocket protocol (from y-protocols source)

Every message has **two layers of type bytes**:

```
[outer_type: varUint]  [inner_type: varUint]  [length-prefixed payload...]
```

Outer types:

| Constant | Value | Purpose |
|---|---|---|
| `messageSync` | `0` | Document sync messages |
| `messageAwareness` | `1` | Presence/cursor updates |
| `messageAuth` | `2` | Authentication |
| `messageQueryAwareness` | `3` | Awareness queries |

Inner sync sub-types (nested inside `messageSync`):

| Constant | Value | Purpose |
|---|---|---|
| `messageYjsSyncStep1` | `0` | Send state vector ("here's what I have") |
| `messageYjsSyncStep2` | `1` | Send missing updates ("here's what you need") |
| `messageYjsUpdate` | `2` | Incremental update |

Connection handshake:

```
Client                                Server
  │                                     │
  │── [0][0][stateVector] ─────────────▶│  SyncStep1: "what I have"
  │                                     │
  │◀── [0][1][missingUpdates] ─────────│  SyncStep2: "what you need"
  │◀── [0][0][serverStateVector] ──────│  SyncStep1: "what do YOU have?"
  │                                     │
  │── [0][1][missingUpdates] ─────────▶│  SyncStep2: "what you need"
  │                                     │
  │◀──────── [0][2][update] ──────────▶│  incremental from here on
```

Both sides exchange state vectors and compute diffs. Payloads are wrapped in `varUint8Array` (length-prefixed byte arrays).

Source: [y-protocols/sync.js](https://github.com/yjs/y-protocols/blob/master/src/sync.js), [y-websocket/y-websocket.js](https://github.com/yjs/y-websocket/blob/master/src/y-websocket.js)

#### Our backend protocol (verified from `origin/crdts` — `websocket.rs`)

Flat single-byte tags, no sub-types, no length prefixing:

```
MSG_SYNC      = 0x00
MSG_AWARENESS = 0x01
```

Connection sequence:

```
Client                                Server
  │                                     │
  │◀── [raw yjs v1 update] ───────────│  full doc state, NO tag byte
  │◀── [0x01][awareness entries] ─────│  if other clients connected
  │                                     │
  │── [0x00][update] ────────────────▶│  incremental edits
  │◀── [0x00][update] ────────────────│  relayed from other clients
```

Key details from the Rust source:

1. **Initial state has NO tag byte.** The server calls `encode_state_as_update_v1` and sends the raw bytes directly — no `0x00` prefix.

2. **Server is lenient on input.** `extract_crdt_update_bytes()` first checks for a `0x00` tag and strips it, then falls back to treating the entire payload as a raw Yjs update. Both formats are accepted.

3. **Broadcasts are opaque relay.** The server sends the exact bytes it received to other clients — no re-encoding.

4. **Awareness uses the same format as y-protocols** — `[0x01]` tag + LEB128-encoded entries with `(client_id, clock, state_json)`.

#### Side-by-side comparison

| Aspect | Our backend (`origin/crdts`) | y-websocket / y-protocols |
|---|---|---|
| **Initial sync** | Server pushes full state immediately as **raw bytes (no tag)** | Bidirectional state-vector negotiation (SyncStep1 ↔ SyncStep2) |
| **Sync update bytes** | `[0x00][raw_update]` (single tag byte) | `[0x00][0x02][varUint8Array(update)]` (two type bytes + length prefix) |
| **Initial state bytes** | `[raw_yjs_v1_update]` (no wrapper at all) | `[0x00][0x01][varUint8Array(update)]` (SyncStep2 message) |
| **State vector exchange** | None — server always sends everything | Required — both sides exchange vectors to compute minimal diffs |
| **Payload wrapping** | Raw bytes after tag | Length-prefixed `varUint8Array` |
| **Awareness format** | `[0x01][LEB128 entries]` | `[0x01][encoded awareness]` — **same format** |
| **Sub-message types** | None — flat `0x00` = sync, `0x01` = awareness | Nested: `0x00` then sub-type `0x00`/`0x01`/`0x02` |
| **Input tolerance** | Lenient: accepts tagged or raw updates | Strict: expects exact protocol format |

#### What breaks if you use y-websocket with our backend

1. **y-websocket sends SyncStep1 on connect**: `[0x00][0x00][state_vector]`. Our backend parses byte 0 as `MSG_SYNC`, strips it, and tries to apply `[0x00][state_vector_bytes]` as a Yjs update. A state vector is not a valid update. **Connection closed.**

2. **Our server's initial state has no tag**: The raw Yjs update bytes arrive. y-websocket reads byte 0 as the outer message type — it's whatever the first byte of the Yjs encoding happens to be, not `0x00` or `0x01`. **Unrecognized message type, silently dropped.**

3. **Double type byte vs single**: y-websocket sends updates as `[0x00][0x02][length][payload]`. Our backend strips byte 0, then tries to parse `[0x02][length][payload]` as a Yjs update. The `0x02` length prefix is not valid update data. **Corrupted parse.**

4. **Length-prefixed vs raw**: Even if the type bytes aligned, y-websocket wraps payloads in `varUint8Array` (length + data). Our backend expects raw bytes after the tag. **Garbled data.**

#### What IS compatible

Awareness format is identical — both use `[0x01]` + LEB128-encoded `(client_id, clock, state_json)` entries. The awareness layer can share encoding/decoding code from `y-protocols/awareness`.

#### Pros and cons

**Our custom protocol:**

| | Pro | Con |
|---|---|---|
| **Simplicity** | ~80 lines of provider code. No SyncStep state machine, no sub-type dispatch, no length-prefix encoding/decoding. Easy to audit end-to-end. | Every new developer must read custom docs instead of pointing to "we use y-websocket." |
| **Latency on connect** | Single message from server → client is synced. No round-trip negotiation. Client renders the document after one `onmessage`. | — |
| **Bandwidth on connect** | — | Server always sends the **entire document** (`encode_state_as_update_v1` against empty `StateVector`). For a 500 KB document, that's 500 KB on every connect, even if the client already has 499 KB of it (e.g. browser refresh, reconnect after brief disconnect). |
| **Reconnection** | Simple: reconnect → receive full state → done. No need to persist a local state vector across disconnects. | Same bandwidth penalty: every reconnect re-downloads the full document. y-protocols would only send the diff since the client's last known state. |
| **Implementation coupling** | — | The provider is tightly coupled to this specific backend. Cannot swap to Hocuspocus, y-redis, y-websocket-server, or any standard Yjs backend without rewriting both sides. |
| **First-message ambiguity** | — | The initial state has no tag byte, requiring a `synced` flag to distinguish it from tagged messages. If the server ever reorders messages or sends a second untagged message, the client misparses. Fragile contract. |
| **Server tolerance** | Server accepts both tagged (`[0x00][update]`) and raw (`[update]`) input. Forgiving for early development. | Lenient parsing can mask bugs. A client sending malformed data might succeed by accident, then fail unpredictably when the fallback path hits an edge case. |
| **Broadcast efficiency** | Opaque relay — server just forwards bytes without decoding/re-encoding. Minimal CPU per message. | — |
| **Ecosystem** | — | No off-the-shelf tooling. No y-websocket devtools, no Hocuspocus admin panel, no community providers. Debugging requires reading raw binary frames. |
| **Code ownership** | Full control over the protocol. Can evolve it without waiting for upstream releases. | Full responsibility for correctness. y-protocols is battle-tested across thousands of production deployments. Our custom parser has zero external users. |

**y-protocols / y-websocket:**

| | Pro | Con |
|---|---|---|
| **Bandwidth efficiency** | State vector exchange means the server only sends what the client is missing. Reconnecting a client that has 99% of the document transfers ~1% of the data. | — |
| **Ecosystem compatibility** | Works with Hocuspocus, y-redis, y-websocket-server, Liveblocks, and any backend implementing y-protocols. Switch backends without changing frontend code. | — |
| **Battle-tested** | Used by Notion, GitLab, and thousands of Tiptap deployments. Edge cases around encoding, clock drift, and partial updates are well-covered. | — |
| **Standardized** | Any developer familiar with Yjs knows the protocol. Docs, tutorials, and Stack Overflow answers all assume y-protocols. | — |
| **Connect latency** | — | Two round-trips: client sends SyncStep1, server responds with SyncStep2, server sends its own SyncStep1, client responds with SyncStep2. Adds one RTT compared to server-push. |
| **Complexity** | — | More moving parts: sub-message type dispatch, length-prefixed encoding, bidirectional sync state machine. ~3x more protocol code than our custom approach. |
| **Server implementation** | — | The Rust backend would need to implement the full sync state machine (read SyncStep1 → compute diff → send SyncStep2). More complex than "send full state, relay updates." |

**Summary:**

Our custom protocol optimizes for **implementation simplicity and connect latency** at the cost of **bandwidth on reconnect and ecosystem lock-in**. This is a reasonable tradeoff for a project with:
- Small documents (notes, not novels) — full-state transfers are cheap
- A custom Rust backend that won't be swapped for Hocuspocus
- A small team that owns both frontend and backend

The tradeoff becomes unfavorable if:
- Documents grow large (collaborative wikis, long-form writing) — full-state transfers become expensive
- The backend needs to interoperate with standard Yjs tooling
- Multiple frontend apps need to connect to the same backend (each would need the custom provider)

### Provider design

The custom provider is simpler than y-websocket because there's less protocol: no SyncStep negotiation, no length-prefixed payloads, no sub-message types. It also needs to handle the server's untagged initial state message.

```
src/
  collaboration/
    WebSocketProvider.ts    ← the provider
```

```typescript
// src/collaboration/WebSocketProvider.ts
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";

const MSG_SYNC      = 0x00;
const MSG_AWARENESS = 0x01;

export interface ProviderOptions {
  noteId: number;
  doc: Y.Doc;
  awareness: Awareness;
}

export class WebSocketProvider {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private awareness: Awareness;
  private noteId: number;
  private connected = false;
  private synced = false;           // true after first message (initial state)
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;    // ms, doubles on each failure

  constructor(options: ProviderOptions) {
    this.doc = options.doc;
    this.awareness = options.awareness;
    this.noteId = options.noteId;
  }

  connect(): void {
    if (this.ws) return;

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/api/notes/${this.noteId}/sync`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.synced = false;

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 1000; // reset on success
      this.sendLocalAwareness();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const data = new Uint8Array(event.data as ArrayBuffer);
      if (data.length === 0) return;

      // The server's FIRST message is the initial doc state
      // as a RAW Yjs v1 update — no tag byte.
      // Subsequent messages are tagged: 0x00 = sync, 0x01 = awareness.
      if (!this.synced) {
        Y.applyUpdate(this.doc, data, "remote");
        this.synced = true;
        return;
      }

      const tag = data[0];
      const payload = data.slice(1);

      if (tag === MSG_SYNC) {
        Y.applyUpdate(this.doc, payload, "remote");
      } else if (tag === MSG_AWARENESS) {
        applyAwarenessUpdate(this.awareness, payload, this);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };

    // Forward local doc updates to the server
    this.doc.on("update", this.handleDocUpdate);

    // Forward local awareness changes
    this.awareness.on("update", this.handleAwarenessUpdate);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.synced = false;
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === "remote") return; // don't echo back server messages
    this.send(MSG_SYNC, update);
  };

  private handleAwarenessUpdate = ({ added, updated, removed }: {
    added: number[]; updated: number[]; removed: number[];
  }): void => {
    const changedClients = [...added, ...updated, ...removed];
    const encoded = encodeAwarenessUpdate(this.awareness, changedClients);
    this.send(MSG_AWARENESS, encoded);
  };

  private send(tag: number, payload: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message = new Uint8Array(1 + payload.length);
    message[0] = tag;
    message.set(payload, 1);
    this.ws.send(message);
  }

  private sendLocalAwareness(): void {
    const states = this.awareness.getStates();
    if (states.size > 0) {
      const encoded = encodeAwarenessUpdate(
        this.awareness,
        Array.from(states.keys())
      );
      this.send(MSG_AWARENESS, encoded);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }
}
```

### Key design decisions

- **First-message detection**: The `synced` flag distinguishes the server's initial raw state dump (no tag byte) from subsequent tagged messages. This matches the actual `send_initial_state()` behavior in `websocket.rs`, which sends `encode_state_as_update_v1` without any prefix.
- **Origin tracking**: `Y.applyUpdate(doc, payload, "remote")` marks incoming updates. The `handleDocUpdate` listener checks `origin === "remote"` to avoid sending updates back to the server that it just received.
- **Tag byte on outgoing messages**: The client always sends `[0x00][update]` for sync. The server's `extract_crdt_update_bytes()` accepts both tagged and raw, but tagged is explicit and preferred.
- **Reconnection**: Exponential backoff from 1s to 30s. On reconnect, the server sends a fresh full state, so no client-side state-vector negotiation is needed.
- **No queuing**: If the socket is closed, local edits are lost in transit. Yjs retains them in the local doc, and they will be reconciled when the reconnection delivers the full server state.
- **Awareness cleanup**: On disconnect, the server automatically broadcasts awareness removal messages for the departing client (incrementing their clock and setting state to `"null"`).

---

## 4. useCollaboration Composable

### What it is

A Vue composable (a function using Vue's Composition API) that acts as the **glue layer** between three things that don't know about each other:

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

It creates and owns five interdependent objects:

| Object | What it is | Who consumes it |
|---|---|---|
| `ydoc` | The Yjs CRDT document | Provider reads/writes it, Tiptap binds to it |
| `yContent` | `ydoc.getXmlFragment("content")` | CollabEditor (Tiptap's `Collaboration.configure({ fragment })`) |
| `yTitle` | `ydoc.getText("title")` | CollabTitle (direct `observe()` / `insert()`) |
| `awareness` | Cursor positions and user presence | CollabEditor (CollaborationCaret extension) |
| `provider` | WebSocket connection to the backend | Feeds updates into ydoc, sends local changes out |

These must be created in the right order (ydoc first, then shared types, then awareness, then provider) and destroyed in reverse. The composable encapsulates this.

### Where the Y.Doc lives

The Y.Doc exists in **three places simultaneously** — the browser copy is ephemeral, the backend copy is durable:

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

| Location | Runtime | Lifetime | Purpose |
|---|---|---|---|
| **Browser** | JavaScript `Y.Doc` | Created on mount, destroyed on unmount | Powers the editor, handles local edits |
| **Backend RAM** | Rust `yrs::Doc` | While WebSocket room is open | Merges updates, relays to other clients |
| **PostgreSQL** | Binary blob | Permanent | Persistence — survives server restarts |

The browser's copy is **ephemeral**. Every time a user opens a note, `useCollaboration` creates a fresh empty `Y.Doc`, the WebSocket delivers the full state from the server, and `Y.applyUpdate()` populates it. When the user closes the note, `ydoc.destroy()` discards it — the PostgreSQL copy is the durable source of truth.

### Why it's needed

Without it, `NoteEdit.vue` would have to do all of this inline:

```typescript
// NoteEdit.vue would need ALL of this in its <script setup>:
const ydoc = new Y.Doc();
const yContent = ydoc.getXmlFragment("content");
const yTitle = ydoc.getText("title");
const awareness = new Awareness(ydoc);
const provider = new WebSocketProvider({ noteId, doc: ydoc, awareness });
const titleText = ref("");

yTitle.observe(() => { titleText.value = yTitle.toString(); });

provider.connect();

// And also pass yContent to CollabEditor, yTitle to CollabTitle,
// awareness to CollaborationCaret, titleText to the template...

// And clean up on unmount:
onUnmounted(() => {
  provider.disconnect();
  ydoc.destroy();
});

// And handle note switching:
watch(selectedNote, (note) => {
  provider.disconnect();
  // ... recreate everything? or reconnect?
});
```

That's ~30 lines of non-UI setup logic cluttering a component that should just render an editor. The composable extracts it into a reusable function with a clean return interface.

### Why a composable instead of a Pinia store?

The current `editStore` is a Pinia store. Four reasons the collaboration state doesn't belong there:

#### 1. Lifecycle mismatch

A Pinia store is a **singleton** — it lives for the entire app session. The collaboration state is **per-editing-session** — it should be created when the user opens a note and destroyed when they close it.

```
Pinia store:    created at app start ──────────────────────────── destroyed at app close
                        ↑ always alive, even when not editing

Composable:              created ── editing ── destroyed    created ── editing ── destroyed
                              note A                              note B
```

If the Y.Doc lived in a store, you'd need manual "reset" logic every time the user switches notes. With a composable tied to a component's lifecycle, `onUnmounted` handles cleanup automatically.

#### 2. Singleton vs instance

If the app ever renders two editors (e.g. side-by-side note comparison), a store can only hold one Y.Doc. Each composable call returns an independent instance:

```typescript
// Two editors, two independent collaboration sessions:
const collab1 = useCollaboration({ noteId: ref(1) });
const collab2 = useCollaboration({ noteId: ref(2) });
```

#### 3. SSR safety

A Pinia store is created during SSR (it's used for server-side data fetching via `onServerPrefetch`). A Y.Doc and WebSocket cannot exist on the server — there's no `window`, no `WebSocket` constructor. The composable is called inside a client-only component or guarded by `onMounted`, so it never runs during SSR.

#### 4. The store held strings — the composable holds CRDT objects

The current `editStore` works because `draftTitle` and `draftContent` are plain strings — serializable, reactive, simple. The collaboration state is fundamentally different:

| editStore (current) | useCollaboration (new) |
|---|---|
| `draftTitle: ref("")` — a string | `yTitle: Y.Text` — a CRDT shared type with event emitters |
| `draftContent: ref("")` — a string | `yContent: Y.XmlFragment` — a tree of XML nodes |
| `save()` — REST PUT call | No save — every keystroke syncs via WebSocket |
| `isDirty` — compare strings | No dirty state — CRDT is always in sync |

CRDT objects don't belong in a Pinia store because they're not serializable (can't be part of `window.__INITIAL_STATE__` for SSR hydration) and their lifecycle doesn't match "live forever."

### Implementation

```
src/
  composables/
    useCollaboration.ts
```

```typescript
// src/composables/useCollaboration.ts
import { ref, onUnmounted, type Ref, shallowRef } from "vue";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { WebSocketProvider } from "@/collaboration/WebSocketProvider";

interface UseCollaborationOptions {
  noteId: Ref<number | null>;
}

interface UseCollaborationReturn {
  ydoc: Y.Doc;
  yContent: Y.XmlFragment;
  yTitle: Y.Text;
  awareness: Awareness;
  provider: Ref<WebSocketProvider | null>;
  titleText: Ref<string>;       // reactive mirror of yTitle
  isConnected: Ref<boolean>;
  connectedUsers: Ref<number>;
}

export function useCollaboration(
  options: UseCollaborationOptions
): UseCollaborationReturn {
  const ydoc = new Y.Doc();
  const yContent = ydoc.getXmlFragment("content");
  const yTitle = ydoc.getText("title");
  const awareness = new Awareness(ydoc);

  const provider = shallowRef<WebSocketProvider | null>(null);
  const titleText = ref("");
  const isConnected = ref(false);
  const connectedUsers = ref(0);

  // --- Title sync ---

  // Remote → local: update the reactive ref when yTitle changes
  yTitle.observe(() => {
    titleText.value = yTitle.toString();
  });

  // Local → remote: called by the title input component
  // (exposed as a method or handled via watch on titleText)

  // --- Provider lifecycle ---

  function connectToNote(noteId: number): void {
    // Tear down previous connection
    provider.value?.disconnect();

    const p = new WebSocketProvider({
      noteId,
      doc: ydoc,
      awareness,
    });
    p.connect();
    provider.value = p;
  }

  function disconnect(): void {
    provider.value?.disconnect();
    provider.value = null;
  }

  // Watch noteId changes — connect/disconnect as the selected note changes
  // (the calling component should watch noteId and call connectToNote)

  onUnmounted(() => {
    disconnect();
    ydoc.destroy();
  });

  return {
    ydoc,
    yContent,
    yTitle,
    awareness,
    provider,
    titleText,
    isConnected,
    connectedUsers,
  };
}
```

---

## 5. Tiptap Editor Components

### Component architecture

```
src/
  components/
    notes/
      CollabEditor.vue      ← Tiptap rich-text editor (binds to Y.XmlFragment)
      CollabTitle.vue        ← Single-line title input (binds to Y.Text)
      NoteEdit.vue           ← Orchestrator (uses useCollaboration, renders both)
      NoteDisplay.vue        ← Read-only rendered view (or removed in favor of editor)
```

### CollabEditor.vue

Wraps Tiptap's `EditorContent` and configures the collaboration extension.

```vue
<script setup lang="ts">
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import type { XmlFragment } from "yjs";
import type { WebSocketProvider } from "@/collaboration/WebSocketProvider";

const props = defineProps<{
  yContent: XmlFragment;
  provider: WebSocketProvider;
}>();

const editor = useEditor({
  // Don't render on the server — wait for client-side hydration.
  // Without this, useEditor accesses `document` during SSR and crashes.
  immediatelyRender: false,

  extensions: [
    StarterKit.configure({
      // Collaboration has its own undo/redo that is per-client and
      // aware of remote operations. The built-in one must be disabled
      // to avoid conflicts.
      // NOTE: `history` was renamed to `undoRedo` in recent Tiptap versions.
      undoRedo: false,
    }),
    Collaboration.configure({
      fragment: props.yContent,
    }),
    CollaborationCaret.configure({
      // CollaborationCaret expects a provider object with an `.awareness`
      // property (like HocuspocusProvider). Our custom WebSocketProvider
      // must expose `public awareness: Awareness` for this to work.
      provider: props.provider,
      user: {
        name: "Anonymous", // replace with actual username
        color: "#ff0000",  // replace with assigned color
      },
    }),
    Placeholder.configure({
      placeholder: "Start writing...",
    }),
  ],
});
</script>

<template>
  <EditorContent :editor="editor" class="tiptap-editor" />
</template>
```

**Key points:**

- **`immediatelyRender: false`** — required for SSR. Without it, `useEditor` accesses browser APIs (`document`, `window`) during server-side rendering and crashes. This tells Tiptap to defer rendering until the client mounts. (Source: [Tiptap Nuxt install guide](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/getting-started/install/nuxt.mdx))

- **`undoRedo: false`** (not `history: false`) — `StarterKit` renamed this option. The old `history: false` no longer works. `Collaboration` provides its own undo manager that tracks which operations belong to which client, so undo only reverts your own changes, not remote ones. (Source: [Tiptap upgrade guide](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/guides/upgrade-tiptap-v2.mdx))

- **`CollaborationCaret`** (not `CollaborationCaret`) — the extension and package were renamed from `@tiptap/extension-collaboration-cursor` to `@tiptap/extension-collaboration-caret`. The `provider` setting accepts a "Y.js network provider" — an object with an `.awareness` property. Our `WebSocketProvider` must expose this. (Source: [CollaborationCaret docs](https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/extensions/functionality/collaboration-caret.mdx))

- **`Collaboration.configure({ fragment })`** binds the editor to the `Y.XmlFragment`. Every keystroke produces a Yjs update, and every remote update is applied to the editor.

**WebSocketProvider change required:** The provider must expose awareness as a public property so `CollaborationCaret` can read it:

```typescript
// In WebSocketProvider.ts — add public property:
export class WebSocketProvider {
  public awareness: Awareness;  // ← CollaborationCaret reads this
  private ws: WebSocket | null = null;
  // ...

  constructor(options: ProviderOptions) {
    this.awareness = options.awareness;  // expose it
    // ...
  }
}
```

### CollabTitle.vue

A plain `<input>` or PrimeVue `InputText` that syncs with `Y.Text` directly — no Tiptap overhead.

```vue
<script setup lang="ts">
import { watch } from "vue";
import InputText from "@/volt/InputText.vue";
import type { Text as YText } from "yjs";

const props = defineProps<{
  yTitle: YText;
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const newValue = target.value;
  const oldValue = props.yTitle.toString();

  // Compute a minimal diff and apply it to Y.Text
  props.yTitle.doc!.transact(() => {
    // Simple approach: delete all, insert new.
    // A smarter diff can be added later for better cursor preservation.
    props.yTitle.delete(0, props.yTitle.length);
    props.yTitle.insert(0, newValue);
  });

  emit("update:modelValue", newValue);
}
</script>

<template>
  <InputText
    :value="modelValue"
    @input="handleInput"
    placeholder="Title"
    fluid
  />
</template>
```

**Improvement opportunity:** A character-level diff (longest common subsequence) instead of delete-all/insert-all would preserve remote users' cursor positions within the title. For an MVP, the simple approach is acceptable.

### v-model patterns — who owns the data

With Yjs, the `Y.Doc` is the source of truth, not Vue reactive state. This changes how `v-model` works:

**Editor content: no v-model.** Tiptap manages its own state internally via the `Y.XmlFragment`. There is no reactive string to bind to — the content is a tree of XML nodes, not a string. The component receives the fragment as a prop and Tiptap reads/writes it through y-prosemirror:

```
Before:  <Textarea v-model="editStore.draftContent" />
                      ↕
              plain string in Pinia store

After:   <EditorContent :editor="editor" />
                      ↕
              Y.XmlFragment inside Y.Doc (tree, not a string)
```

**Title: v-model as a reactive mirror.** The `<CollabTitle>` uses `v-model` on `titleText`, but `titleText` is **not the source of truth** — `yTitle` (Y.Text) is. The `v-model` is a read-only mirror of the CRDT state for rendering purposes:

```
User types → handleInput() → yTitle.delete() + yTitle.insert()
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

When a remote user changes the title, `yTitle.observe()` fires → `titleText` updates → the input re-renders. Edits go **through `yTitle`**, not through `v-model`.

| Field | v-model? | Source of truth |
|---|---|---|
| Content (Tiptap) | **No** | `Y.XmlFragment` in Y.Doc |
| Title (input) | **Yes, but reactive mirror only** | `Y.Text` in Y.Doc |

---

## 6. Store Changes

### editStore — simplification

The current `editStore` manages `draftTitle`, `draftContent`, and `isDirty` for REST-based saving. With Yjs, every keystroke is synced in real time — there is no "save" action and no dirty tracking.

**What changes:**

| Current | After Tiptap |
|---|---|
| `draftTitle: ref("")` | Removed — `useCollaboration().titleText` replaces it |
| `draftContent: ref("")` | Removed — Tiptap editor state lives in the Y.Doc, not a string |
| `isDirty: computed(...)` | Removed — no concept of unsaved changes |
| `save()` | Removed — persistence is handled by the backend on every WebSocket update |
| `reset()` | Removed — canceling an edit means disconnecting from the WebSocket |
| `watch(selectedNote)` | Removed — `useCollaboration` handles note switching |

The `editStore` can be **deleted entirely** or reduced to a thin wrapper that only holds connection status:

```typescript
// Simplified editStore (optional — could just use the composable directly)
export const useEditStore = defineStore("editLive", () => {
  const isConnected = ref(false);
  const connectedUsers = ref(0);
  return { isConnected, connectedUsers };
});
```

Alternatively, delete the store and let `NoteEdit.vue` use the composable directly. The store existed because the `<Textarea>` needed reactive strings; Tiptap manages its own state.

### noteStore — cleanup

The `noteStore` mostly stays the same since it handles the note list (REST `GET /api/notes`, `DELETE /api/notes/{id}`). Changes:

| Method | Change |
|---|---|
| `fetchNotes()` | Keep as-is — lists notes for the sidebar |
| `createNote()` | Keep, but the response should include the note ID. After creation, `useCollaboration` opens a WebSocket to the new note. |
| `editNote()` | **Remove** — there is no more `PUT` endpoint. All editing goes through WebSocket. |
| `deleteNote()` | Keep as-is |
| `selectedNote` | Keep — still used to track which note is selected in the sidebar. The `useCollaboration` composable watches this to connect/disconnect. |

The `editNote()` method currently does `PUT /api/notes/{id}`, but per the backend workflow doc, there is no `PUT` endpoint — all document modifications happen through the WebSocket sync channel. Remove `editNote()`.

---

## 7. Component Changes

### NoteEdit.vue

**Before:** Renders `<InputText>` + `<Textarea>` + Save/Cancel buttons.

**After:** Orchestrates `CollabTitle` + `CollabEditor` via `useCollaboration`.

```vue
<script setup lang="ts">
import { watch, onMounted } from "vue";
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import CollabEditor from "./CollabEditor.vue";
import CollabTitle from "./CollabTitle.vue";
import { useCollaboration } from "@/composables/useCollaboration";
import { useNoteStore } from "@/stores/noteStore";

const noteStore = useNoteStore();

const {
  yContent,
  yTitle,
  awareness,
  titleText,
  isConnected,
  provider,
} = useCollaboration();

const emit = defineEmits<{
  cancel: [];
}>();

// Connect to the selected note's WebSocket when the note changes
watch(
  () => noteStore.selectedNote,
  (note) => {
    if (note) {
      provider.value?.disconnect();
      // ... connect to new note
    }
  },
  { immediate: true }
);

function handleCancel() {
  provider.value?.disconnect();
  emit("cancel");
}
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>
      <CollabTitle :y-title="yTitle" v-model="titleText" />
    </template>
    <template #content>
      <div class="flex flex-col gap-4 h-full">
        <CollabEditor :y-content="yContent" :awareness="awareness" />
        <div class="flex gap-2 justify-end">
          <Button label="Close" severity="secondary" text @click="handleCancel" />
          <!-- No "Save" button — edits are synced in real time -->
        </div>
      </div>
    </template>
  </Card>
</template>
```

**Key differences from current:**

- No Save button — every edit is persisted by the backend immediately.
- No dirty tracking or unsaved-changes dialog — the CRDT ensures all edits reach the server.
- Cancel becomes "Close" — it disconnects the WebSocket and returns to the note list.

#### Before vs after structure

```
NoteEdit.vue (before)                NoteEdit.vue (after)
├── editStore (Pinia)                ├── useCollaboration() composable
├── <InputText v-model>              ├── <CollabTitle :y-title v-model>
├── <Textarea v-model>               ├── <CollabEditor :y-content :provider>
├── <Button "Save">                  └── <Button "Close">
└── <Button "Cancel">
```

### NotesView.vue

The parent view that holds the sidebar + editor area. The note-creation flow changes:

**Before:**

```
User clicks "+"  →  showEditForm = true  →  renders blank NoteEdit
User clicks Save →  REST POST creates note  →  showEditForm = false
```

**After:**

```
User clicks "+"  →  noteStore.createNote()  →  REST POST returns { id }
                 →  noteStore.selectedNote = newNote
                 →  NoteEdit mounts  →  useCollaboration connects via WebSocket
```

No more `showEditForm` flag. Creating a note is:

1. REST POST to get the note ID.
2. Select it in the sidebar.
3. Editor opens and WebSocket connects — same flow as opening an existing note.

The `NoteEdit` / `NoteDisplay` toggle logic also changes — see below.

### NoteDisplay.vue

Two options:

| Option | Approach | Tradeoff |
|---|---|---|
| **Delete it** | Tiptap editor with `editable: false` for read-only view | Loads Yjs + Tiptap just to view a note |
| **Keep it** (recommended) | Render `content_preview` from REST API | Lightweight, no WebSocket needed for browsing |

Recommended: keep `NoteDisplay` but feed it the `content_preview` from the REST API for lightweight display, and switch to the full collaborative editor when the user clicks "Edit."

```
Sidebar click → NoteDisplay shows content_preview (REST, lightweight)
Edit button   → NoteEdit replaces it (WebSocket + Tiptap, full collab)
```

### NoteCreateForm.vue

This component is currently unused (`NotesView.vue` has it commented out). It can be deleted. Note creation should:

1. Call `POST /api/notes` (via `noteStore.createNote()`).
2. Receive the new note's ID.
3. Immediately open the collaborative editor connected to that note via WebSocket.

The title and content are then set through the Yjs fields, not through a form.

### Component tree summary

```
NotesView.vue
├── Sidebar (Listbox)              ← unchanged
├── "+" button                     ← createNote() → select → WS connect
│
├── NoteDisplay (when viewing)     ← keep, use content_preview from REST
└── NoteEdit (when editing)        ← rewrite: useCollaboration + Collab components
    ├── CollabEditor.vue           ← NEW
    ├── CollabTitle.vue            ← NEW
    └── ClientOnly.vue             ← NEW (SSR guard)

NoteCreateForm.vue                 ← DELETE
```

---

## 8. SSR Safety

The app uses Vue SSR with Fastify (`entry-server.ts` / `entry-client.ts`). Yjs and WebSocket are browser-only APIs that don't exist on the server (`WebSocket`, `document`, `window` are all undefined in Node.js).

### What breaks without SSR guards

```
Frontend Server (Node.js)
        │
        ▼
Renders NoteEdit.vue
        │
        ▼
useCollaboration() runs
        │
        ├── new Y.Doc()          ← works (pure JS), but pointless on server
        ├── new WebSocket(url)   ← CRASH: WebSocket is not defined
        └── useEditor()          ← CRASH: document is not defined
```

### Three layers of protection

**1. `useCollaboration` guard** — don't create Y.Doc or WebSocket on the server:

```typescript
// Inside useCollaboration:
if (typeof window !== "undefined") {
  // Y.Doc, WebSocket, Awareness — only created in browser
}
```

**2. `<ClientOnly>` wrapper** — Tiptap's `useEditor` accesses `document` and `window` internally. Even with `immediatelyRender: false`, it needs to be kept off the server entirely:

```vue
<!-- In NoteEdit.vue -->
<template>
  <ClientOnly>
    <CollabEditor :y-content="yContent" :awareness="awareness" />
    <template #fallback>
      <div class="skeleton-editor">Loading editor...</div>
    </template>
  </ClientOnly>
</template>
```

`ClientOnly` is a simple component — renders the fallback slot on the server, swaps to the real slot after `onMounted`:

```vue
<!-- src/components/ClientOnly.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
</script>
<template>
  <slot v-if="mounted" />
  <slot v-else name="fallback" />
</template>
```

**3. Server prefetch stays REST-only** — `onServerPrefetch` in `NotesView.vue` fetches the note list via REST (`GET /api/notes`). This populates the sidebar HTML. No collaboration happens during SSR. The collaborative editing session starts only after client-side hydration.

### What runs where

```
Frontend Server (SSR)              Browser (after hydration)
┌────────────────────┐            ┌─────────────────────────┐
│ GET /api/notes     │            │ Hydrate sidebar HTML    │
│ Render sidebar HTML│            │ Mount Tiptap editor     │
│ Render skeleton    │──── HTML ──►│ Create Y.Doc            │
│ Serialize Pinia    │            │ Connect WebSocket       │
│ Send to browser    │            │ Receive doc state       │
└────────────────────┘            │ Editor becomes live     │
                                  └─────────────────────────┘
```

| Component | Server renders | Browser hydrates |
|---|---|---|
| Sidebar (Listbox) | Full HTML from REST data | Adds click handlers |
| CollabEditor | Skeleton placeholder | Mounts Tiptap, connects WebSocket |
| CollabTitle | Skeleton or static text | Mounts with Y.Text binding |

### Pinia state serialization

Pinia state crosses the SSR boundary via `window.__INITIAL_STATE__`:

```
Server: noteStore.notes = [{id: 1, title: "Hello"}]
        ↓ serialized as JSON
Browser: window.__INITIAL_STATE__ = { noteStore: { notes: [...] } }
        ↓ Pinia restores it
Browser: noteStore.notes already populated, no re-fetch needed
```

The `selectedNote` and `notes` array are serialized. The Y.Doc is **never serialized** — it's not in Pinia, it's not in `__INITIAL_STATE__`. It's created fresh in the browser and populated by the WebSocket sync message. This is by design — CRDT binary state can't be JSON-serialized, and there's no point pre-rendering editor content the user hasn't asked to edit yet.

---

## 9. End-to-End Flow

### Current typing flow (REST-based, what exists today)

The current codebase has no Y.Doc, no WebSocket, no real-time sync:

```
User types in <Textarea>
        │
        ▼
v-model updates editStore.draftContent (plain string)
        │
        ▼
isDirty becomes true (draft !== original)
        │
        ▼
User clicks "Save"
        │
        ▼
editStore.save() → PUT /api/notes/{id} → server overwrites DB row
```

| Aspect | Current (REST) | Proposed (CRDT) |
|---|---|---|
| User types | String updates in Pinia store | Y.Doc CRDT operation |
| Persistence | Explicit "Save" button | Every keystroke, automatic |
| Conflict resolution | Last write wins (REST PUT) | CRDT merge (no conflicts) |
| Multi-user | Overwrites each other | Concurrent edits merge cleanly |
| Latency | Local instant, save is a round-trip | Local instant, sync is background |

### Opening an existing note

```
User clicks note in sidebar
        │
        ▼
NotesView: sets noteStore.selectedNote
        │
        ▼
NoteEdit: watch(selectedNote) fires
        │
        ▼
useCollaboration: creates Y.Doc + Awareness
        │
        ▼
WebSocketProvider.connect()
        │
        ├─── WebSocket opens to /api/notes/{id}/sync
        │
        ▼
Server sends full doc state (0x00 + binary)
        │
        ▼
Provider: Y.applyUpdate(doc, payload, "remote")
        │
        ├──▶ yContent (XmlFragment) now has the document tree
        │    └──▶ Tiptap re-renders the editor content
        │
        └──▶ yTitle (Text) now has the title string
             └──▶ titleText.value updates via observe()
                  └──▶ CollabTitle input shows the title

Server sends awareness state (0x01 + binary)
        │
        ▼
Provider: applyAwarenessUpdate(awareness, payload)
        │
        └──▶ CollaborationCaret renders remote cursors
```

### Typing in the editor

```
User types in CollabEditor
        │
        ▼
Tiptap ──▶ ProseMirror transaction
        │
        ▼
y-prosemirror ──▶ Y.Doc transaction
        │
        ├──▶ Y.Doc "update" event fires
        │         │
        │         ▼
        │    WebSocketProvider.handleDocUpdate()
        │         │
        │         ▼
        │    WS send: [0x00] + update bytes
        │         │
        │         ▼
        │    Server receives, persists, broadcasts
        │         │
        │         ▼
        │    Other clients receive, apply, render
        │
        └──▶ Local Tiptap view updates immediately (optimistic)
```

### Editing the title

```
User types in CollabTitle
        │
        ▼
handleInput() ──▶ yTitle.delete() + yTitle.insert()
        │              inside doc.transact()
        │
        ├──▶ Y.Doc "update" event ──▶ WS send
        │
        └──▶ yTitle.observe() fires ──▶ titleText.value updates
```

### Creating a new note

```
User clicks "+" in sidebar
        │
        ▼
noteStore.createNote(title, content)
        │
        ▼
POST /api/notes ──▶ server creates yrs Doc with
        │              Y.Text("title") + Y.XmlFragment("content")
        │
        ▼
Response: { id, title_preview, content_preview }
        │
        ▼
noteStore.selectedNote = newNote
        │
        ▼
NoteEdit: watch fires ──▶ useCollaboration connects
        │
        ▼
(same flow as "Opening an existing note")
```

### Closing / navigating away

```
User clicks "Close" or selects different note
        │
        ▼
WebSocketProvider.disconnect()
        │
        ├──▶ WebSocket closes
        │
        ├──▶ doc.off("update", ...) — stop listening
        │
        └──▶ awareness.off("update", ...) — stop listening
        │
        ▼
Server: removes client from room
        │
        ├──▶ broadcasts awareness removal to remaining clients
        │
        └──▶ if last client: room is destroyed
             (doc lives only in PostgreSQL now)
```

---

## Summary of Changes by File

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | Add Tiptap + Yjs deps, optionally remove CodeMirror |
| `src/collaboration/WebSocketProvider.ts` | **New** | Custom binary WebSocket provider |
| `src/composables/useCollaboration.ts` | **New** | Y.Doc lifecycle, reactive title, provider management |
| `src/components/notes/CollabEditor.vue` | **New** | Tiptap editor bound to Y.XmlFragment |
| `src/components/notes/CollabTitle.vue` | **New** | Title input bound to Y.Text |
| `src/components/ClientOnly.vue` | **New** | SSR guard wrapper |
| `src/components/notes/NoteEdit.vue` | Modify | Replace Textarea/InputText with CollabEditor/CollabTitle |
| `src/components/notes/NoteDisplay.vue` | Modify | Use content_preview for static display |
| `src/views/NotesView.vue` | Modify | Adjust edit/display toggle, new-note flow |
| `src/stores/editStore.ts` | **Delete** or simplify | No more draft state / save / dirty tracking |
| `src/stores/noteStore.ts` | Modify | Remove `editNote()`, keep list + create + delete |
| `src/types.ts` | Modify | Update `Note` interface if preview fields are added |
| `src/components/notes/NoteCreateForm.vue` | **Delete** | Unused, note creation goes through store + WS |

### Backend changes required (not covered here)

- Change `"content"` field from `Y.Text` to `Y.XmlFragment` in note creation.
- Add Nginx WebSocket upgrade headers for `/api/notes/{id}/sync`.
- Implement `title_preview` / `content_preview` updates when the document changes.
