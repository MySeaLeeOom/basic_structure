# WebSocketProvider Design

Custom Yjs WebSocket provider at `src/collaboration/WebSocketProvider.ts` that speaks our backend's binary protocol. For the awareness/cursor subsystem, see [live-cursors.md](./live-cursors.md). For the backend workflow, see [overview.md](./overview.md).

---

## 1. Why Not y-websocket

The standard `y-websocket` library implements the y-protocols sync protocol: a bidirectional state-vector negotiation handshake with nested sub-message types and length-prefixed payloads. Our backend uses a simpler custom protocol. The two are wire-incompatible.

Specific incompatibilities:

1. **y-websocket sends SyncStep1 on connect**: `[0x00][0x00][state_vector]`. Our backend parses byte 0 as `MSG_SYNC`, strips it, tries to apply `[0x00][state_vector]` as a Yjs update. A state vector is not a valid update — connection breaks.

2. **Our server's initial state has no tag**: Raw Yjs update bytes arrive. y-websocket reads byte 0 as the outer message type — it's whatever the first byte of the Yjs encoding happens to be, not a valid type tag. Message silently dropped.

3. **Double type byte vs single**: y-websocket sends updates as `[0x00][0x02][length][payload]`. Our backend strips byte 0, tries to parse `[0x02][length][payload]` as a Yjs update. Corrupted parse.

4. **Length-prefixed vs raw**: y-websocket wraps payloads in `varUint8Array` (length + data). Our backend expects raw bytes after the tag.

---

## 2. Binary Protocol

### Tag bytes

```
MSG_SYNC      = 0x00
MSG_AWARENESS = 0x01
```

### Connection sequence

```
Client                                   Server
  │                                        │
  │   ◄── [raw Yjs V1 update] ────────── │  send_initial_state()
  │       NO tag byte                      │
  │                                        │
  │   ◄── [0x01][awareness entries] ───── │  if other clients connected
  │                                        │
  │ ── [0x01][local awareness] ─────────► │  client announces presence
  │                                        │
  │ ── [0x00][update] ─────────────────► │  incremental edits
  │   ◄── [0x00][update] ──────────────── │  relayed from other clients
  │                                        │
  │ ── [0x01][awareness] ──────────────► │  cursor/presence changes
  │   ◄── [0x01][awareness] ───────────── │  relayed from other clients
```

Broadcasts are opaque relay — the server forwards the exact bytes it received to all other clients.

### First-message detection (`synced` flag)

The initial state message has **no tag byte**. The provider uses a `synced` boolean to distinguish it from subsequent tagged messages:

```
synced = false  →  treat entire payload as raw Yjs update
                   Y.applyUpdate(doc, data, "remote")
                   synced = true

synced = true   →  read data[0] as tag byte
                   0x00 → Y.applyUpdate(doc, data.slice(1), "remote")
                   0x01 → applyAwarenessUpdate(awareness, data.slice(1))
```

This works because the server guarantees the first binary message is always the initial state (`send_initial_state` is called before `send_initial_awareness`).

---

## 3. Class Interface

### Constructor options

```typescript
interface ProviderOptions {
  noteId: string;       // UUID, used for WebSocket URL: /api/notes/{noteId}/sync
  doc: Y.Doc;           // The Yjs document instance
  awareness: Awareness; // Awareness instance for cursor/presence
}
```

### Public properties

| Property | Type | Description |
|----------|------|-------------|
| `awareness` | `Awareness` | Exposed for `CollaborationCaret.configure({ provider })` |
| `synced` | `boolean` (read-only) | `true` after the initial state message has been applied |
| `connected` | `boolean` (read-only) | `true` while the WebSocket is open |

### Public methods

| Method | Description |
|--------|-------------|
| `connect()` | Opens the WebSocket, starts receiving updates. No-op if already connected. |
| `disconnect()` | Closes the WebSocket, removes listeners, cancels reconnect timer. |
| `destroy()` | Alias for `disconnect()`. |

---

## 4. Design Decisions

### Listener lifecycle: register in constructor, remove in `disconnect()`

Y.Doc and Awareness event listeners are registered once in the constructor, not in `connect()`. Yjs `Observable` does not deduplicate listeners — calling `connect()` twice (e.g. on reconnect) would register duplicate listeners, causing every update to be sent twice.

The listeners check `ws.readyState === OPEN` before sending, so they are no-ops when disconnected.

### Origin tracking (prevents echo loops)

```typescript
// Incoming: mark as "remote"
Y.applyUpdate(this.doc, payload, "remote");

// Outgoing: skip "remote" origin (don't echo back)
handleDocUpdate = (update, origin) => {
  if (origin === "remote") return;
  this.send(MSG_SYNC, update);
};
```

### Post-reconnect reconciliation

After reconnecting and receiving the server's full state, the provider sends the full local document state back:

```typescript
const localState = Y.encodeStateAsUpdate(this.doc);
this.send(MSG_SYNC, localState);
```

While disconnected, the user may have continued editing. Sending the full local state pushes offline changes to the server. This is safe because CRDT updates are idempotent.

### No message queuing

When the WebSocket is closed, outgoing messages are silently dropped. On reconnection, the full-state exchange reconciles everything — queuing would add complexity for no benefit.

### SSR safety is the composable's responsibility

The provider accesses `WebSocket` and `location`, which don't exist in Node.js. It does not guard against SSR internally — `useCollaboration` prevents provider creation on the server.

---

## 5. Reconnection

| Parameter | Value |
|-----------|-------|
| Initial delay | 1000 ms |
| Backoff multiplier | 2x |
| Maximum delay | 30,000 ms |
| Reset | On successful `onopen` |
| Guard | `shouldReconnect` flag — `true` from `connect()`, `false` from `disconnect()` |

On reconnect, the server sends a fresh full state. The `synced` flag resets to `false` at the start of each `connect()` call to handle the untagged first message correctly.
