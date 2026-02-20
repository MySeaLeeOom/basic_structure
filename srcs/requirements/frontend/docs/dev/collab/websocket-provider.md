# WebSocketProvider Design

This document captures the protocol analysis, design decisions, and class interface for `src/collaboration/WebSocketProvider.ts` — a custom Yjs WebSocket provider that speaks our backend's binary protocol.

**Source material:**
- `notes-rs/src/handlers/websocket.rs` — backend protocol implementation
- `frontend/docs/dev/collab/tiptap-yjs-integration.md` §3 — reference code
- `y-protocols/awareness.js` — awareness encoding functions

---

## 1. Purpose

The standard `y-websocket` library (`WebsocketProvider`) implements the y-protocols sync protocol: a bidirectional state-vector negotiation handshake with nested sub-message types and length-prefixed payloads. Our backend (`notes-rs`) uses a simpler custom protocol. The two are wire-incompatible — plugging `y-websocket` into our backend would corrupt data.

Specific incompatibilities:

1. **y-websocket sends SyncStep1 on connect**: `[0x00][0x00][state_vector]`. Our backend parses byte 0 as `MSG_SYNC`, strips it, tries to apply `[0x00][state_vector]` as a Yjs update. A state vector is not a valid update — connection breaks.

2. **Our server's initial state has no tag**: Raw Yjs update bytes arrive. y-websocket reads byte 0 as the outer message type — it's whatever the first byte of the Yjs encoding happens to be, not a valid type tag. Message silently dropped.

3. **Double type byte vs single**: y-websocket sends updates as `[0x00][0x02][length][payload]`. Our backend strips byte 0, tries to parse `[0x02][length][payload]` as a Yjs update. Corrupted parse.

4. **Length-prefixed vs raw**: y-websocket wraps payloads in `varUint8Array` (length + data). Our backend expects raw bytes after the tag.

A custom provider of ~80 lines replaces all of this with direct binary message handling.

---

## 2. Binary Protocol Reference

### Tag bytes

```
MSG_SYNC      = 0x00    // websocket.rs:20
MSG_AWARENESS = 0x01    // websocket.rs:21
```

### Connection sequence

```
Client                                   Server
  │                                        │
  │   ◄── [raw Yjs V1 update] ────────── │  send_initial_state()
  │       NO tag byte                      │  encode_state_as_update_v1(&StateVector::default())
  │                                        │  (websocket.rs:172-183)
  │                                        │
  │   ◄── [0x01][awareness entries] ───── │  send_initial_awareness()
  │       only if other clients present    │  (websocket.rs:185-207)
  │                                        │
  │ ── [0x01][local awareness] ─────────► │  client sends awareness on open
  │                                        │
  │ ── [0x00][update] ─────────────────► │  incremental edits
  │   ◄── [0x00][update] ──────────────── │  relayed from other clients (*)
  │                                        │
  │ ── [0x01][awareness] ──────────────► │  cursor/presence changes
  │   ◄── [0x01][awareness] ───────────── │  relayed from other clients (*)
```

*(\*) Broadcasts are opaque relay — the server forwards the exact bytes it received to all other clients in the room (websocket.rs:90, 261).*

### Incoming messages (server → client)

| Order | Format | Description |
|-------|--------|-------------|
| 1st message | `[raw Yjs V1 update]` | Full document state, **no tag byte**. `encode_state_as_update_v1` against empty `StateVector` — always sends everything. |
| 2nd message (optional) | `[0x01][encoded entries]` | Awareness states of all currently connected clients. Omitted if no other clients are in the room. |
| Subsequent | `[0x00][update]` | Incremental CRDT updates relayed from other clients. |
| Subsequent | `[0x01][encoded entries]` | Awareness updates relayed from other clients. |

The first message is distinguished from subsequent ones by the absence of a tag byte. The provider uses a `synced` flag to track this: `false` on connect, set to `true` after the first message is processed.

### Outgoing messages (client → server)

| Format | Description |
|--------|-------------|
| `[0x00][update]` | CRDT update (always tagged) |
| `[0x01][encoded entries]` | Awareness update |

The server's `extract_crdt_update_bytes()` accepts both tagged (`[0x00][update]`) and raw (`[update]`) formats (websocket.rs:264-278), but the client always sends tagged for explicitness.

### First-message detection (`synced` flag)

The `synced` flag is the mechanism for handling the protocol's asymmetry:

```
synced = false  →  on first onmessage  →  treat entire payload as raw Yjs update
                                          Y.applyUpdate(doc, data)
                                          synced = true

synced = true   →  on subsequent messages  →  read data[0] as tag byte
                                              0x00: Y.applyUpdate(doc, data.slice(1))
                                              0x01: applyAwarenessUpdate(awareness, data.slice(1))
```

This works because the server guarantees the first binary message on any connection is always the initial state (websocket.rs:47 — `send_initial_state` is called before `send_initial_awareness`).

**Edge case**: if the server were to reorder messages or send a second untagged message, the client would misparse. The contract is fragile but correct given the current server implementation.

---

## 3. Awareness Wire Compatibility

The backend's custom awareness encoding (websocket.rs:314-326) is structurally identical to what `y-protocols/awareness` produces. Both use:

```
[0x01]                          // tag byte
[num_entries: LEB128 varint]    // number of awareness entries
for each entry:
  [client_id: LEB128 varint]    // Yjs client ID
  [clock: LEB128 varint]        // monotonic counter
  [state_json_len: LEB128 varint][state_json_bytes: UTF-8]
```

The LEB128 varint encoding (websocket.rs:328-360) uses the standard unsigned format: 7 data bits per byte, high bit as continuation flag. This is the same encoding used by `y-protocols` (`lib0/encoding`).

After stripping the `0x01` tag byte, the payload is directly compatible with `applyAwarenessUpdate()` from `y-protocols/awareness`. The `encodeAwarenessUpdate()` output can be prepended with `0x01` and sent to the server.

**In the provider:**
- **Incoming**: strip `data[0]` (the `0x01` tag), pass `data.slice(1)` to `applyAwarenessUpdate()`
- **Outgoing**: `encodeAwarenessUpdate()` returns the payload, prepend `0x01`, send

---

## 4. Class Interface

### File location

```
src/collaboration/WebSocketProvider.ts
```

### Constructor options

```typescript
interface ProviderOptions {
  noteId: number;
  doc: Y.Doc;
  awareness: Awareness;
}
```

| Option | Type | Description |
|--------|------|-------------|
| `noteId` | `number` | Note ID, used to construct the WebSocket URL (`/api/notes/{noteId}/sync`) |
| `doc` | `Y.Doc` | The Yjs document instance. Updates are applied to and read from this doc. |
| `awareness` | `Awareness` | The awareness instance for cursor/presence tracking. |

### Public properties

| Property | Type | Description |
|----------|------|-------------|
| `awareness` | `Awareness` | Exposed for `CollaborationCaret.configure({ provider })` — the extension reads `provider.awareness`. |
| `synced` | `boolean` (read-only) | `true` after the initial state message has been applied. |
| `connected` | `boolean` (read-only) | `true` while the WebSocket is open. |

### Public methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect()` | `(): void` | Opens the WebSocket, registers Y.Doc and awareness listeners, starts receiving updates. No-op if already connected. |
| `disconnect()` | `(): void` | Closes the WebSocket, removes listeners, cancels reconnect timer. |
| `destroy()` | `(): void` | Alias for `disconnect()`. Provided for API parity with other Yjs providers. |

### Internal state

| Field | Type | Purpose |
|-------|------|---------|
| `ws` | `WebSocket \| null` | Current WebSocket connection. |
| `synced` | `boolean` | `false` until the first message (raw initial state) is processed. |
| `connected` | `boolean` | Tracks WebSocket open/close state. |
| `shouldReconnect` | `boolean` | `true` when `connect()` was called, `false` after `disconnect()`. Controls whether `onclose` triggers reconnection. |
| `reconnectTimer` | `ReturnType<typeof setTimeout> \| null` | Handle for the pending reconnect timeout. |
| `reconnectDelay` | `number` | Current backoff delay in ms. |

---

## 5. Design Decisions

### Listener lifecycle: register in constructor, not `connect()`

Y.Doc and Awareness event listeners (`doc.on("update", ...)`, `awareness.on("update", ...)`) are registered once in the constructor and removed in `destroy()`. They are **not** registered/removed on each `connect()`/`disconnect()` cycle.

**Reason**: Yjs `Observable` does not deduplicate listeners. If `connect()` is called twice (e.g., reconnect after disconnect), registering in `connect()` would add a second listener, causing every update to be sent twice. Registering once in the constructor avoids this.

The listeners check `this.ws?.readyState === WebSocket.OPEN` before sending, so they are no-ops when disconnected.

### Post-reconnect reconciliation

After reconnecting and receiving the server's full state via the initial message, the provider sends the full local document state back to the server:

```typescript
// After applying initial state:
const localState = Y.encodeStateAsUpdate(this.doc);
this.send(MSG_SYNC, localState);
```

**Reason**: While disconnected, the user may have continued editing (Yjs retains all operations in the local doc). The server's initial state does not include these offline edits. Sending the full local state after sync pushes any offline changes to the server, which merges them via CRDT and broadcasts to other clients.

This is safe because CRDT updates are idempotent — sending already-known state is a no-op on the receiving end.

### No message queuing

When the WebSocket is closed, outgoing messages are silently dropped (`send()` checks `readyState` and returns early). There is no outbound queue.

**Reason**: Yjs retains all operations in the local `Y.Doc`. On reconnection:
1. Server sends full state → client applies it (merges with local state)
2. Client sends full local state → server applies it (captures offline edits)

The CRDT guarantees convergence after this exchange. Queuing would add complexity for no benefit — the full-state exchange on reconnect is equivalent to replaying every queued message.

### SSR safety is the composable's responsibility

The provider constructor accesses `WebSocket` and `location`, which don't exist in Node.js SSR. The provider does **not** guard against SSR internally.

**Reason**: The `useCollaboration` composable already guards provider creation with `typeof window !== "undefined"` and `onMounted()`. Adding SSR checks inside the provider would be redundant defense-in-depth that obscures responsibility. The provider assumes it runs in a browser.

### Origin tracking to prevent echo

`Y.applyUpdate(doc, payload, "remote")` marks incoming updates with the origin `"remote"`. The `doc.on("update")` listener checks `origin === "remote"` to avoid sending server-received updates back to the server:

```typescript
private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
  if (origin === "remote") return;
  this.send(MSG_SYNC, update);
};
```

This is critical: without it, every incoming update would trigger an outgoing send, creating an infinite loop.

---

## 6. Reconnection Strategy

| Parameter | Value |
|-----------|-------|
| Initial delay | 1000 ms |
| Backoff multiplier | 2x |
| Maximum delay | 30000 ms (30s) |
| Reset | On successful connection (`onopen`) |
| Guard | `shouldReconnect` flag — set `true` by `connect()`, `false` by `disconnect()` |

```
connect() called
  │
  ▼
WebSocket opens → reconnectDelay = 1000, shouldReconnect = true
  │
  ▼
WebSocket closes unexpectedly
  │
  ├── shouldReconnect === false? → stop (user called disconnect())
  │
  └── shouldReconnect === true? → schedule reconnect after reconnectDelay
                                   reconnectDelay *= 2 (capped at 30000)
                                   │
                                   ▼
                                 connect() → WebSocket opens → delay resets to 1000
```

On reconnect, the server sends a fresh full state (websocket.rs:47), so no client-side state-vector persistence is needed. The `synced` flag resets to `false` at the start of each `connect()` call to correctly handle the untagged first message.

---

## 7. Dependencies

The provider imports from `y-protocols/awareness`:

```typescript
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
```

This package must be installed:

```bash
pnpm add y-protocols
```

`y-protocols` is a peer dependency of `yjs` and is commonly used alongside it. It provides the awareness encoding/decoding functions that produce the exact binary format our backend expects (LEB128 varints + varstrings).
