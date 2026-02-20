# Tiptap Implementation Plan

Based on [Tiptap Yjs frontend integration](../collab/tiptap-yjs-integration.md).

---

## Step 1 — Backend fixes

### 1a. Change `"content"` field to XmlFragment

**File:** `notes-rs/src/handlers/notes.rs:53-54`

```rust
// Before:
let content_text = doc.get_or_insert_text("content");

// After:
let content_frag = doc.get_or_insert_xml_fragment("content");
```

Remove the `content_text.insert(...)` call — XmlFragment starts empty, Tiptap populates it.

### 1b. Add WebSocket upgrade headers to Nginx

**File:** `nginx/conf/nginx.conf` — `/api/notes` location block (line 7-9)

```nginx
location /api/notes {
    proxy_pass http://notes:3003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

#### Why this is needed

A WebSocket connection starts as a normal HTTP request with upgrade headers:

```
GET /api/notes/123/sync HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
```

The browser sends this to nginx. Nginx picks the location block by longest prefix match:

| Location | Prefix length | Matches `/api/notes/123/sync`? |
|---|---|---|
| `/api/notes` | 10 chars | Yes — **wins** |
| `/` | 1 char | Yes — but shorter, loses |

So the request hits `location /api/notes`, which currently has no upgrade config. Two problems:

1. **`proxy_http_version` defaults to 1.0** — HTTP/1.0 doesn't support connection upgrades at all.
2. **Nginx strips `Upgrade` and `Connection` headers by default** — they're hop-by-hop headers, not forwarded unless explicitly configured.

What the backend actually receives:

```
GET /api/notes/123/sync HTTP/1.0
Host: notes:3003
# No Upgrade header, no Connection header
```

Axum sees a plain GET, not a WebSocket upgrade. The `WebSocketUpgrade` extractor fails → client gets an HTTP error instead of `101 Switching Protocols`.

The three config lines fix this:
- `proxy_http_version 1.1` — use HTTP/1.1, which supports upgrades
- `proxy_set_header Upgrade $http_upgrade` — forward the Upgrade header
- `proxy_set_header Connection "upgrade"` — forward the Connection header

Note: the catch-all `location /` already has these headers (for Vite HMR), but `/api/notes/*` never reaches it due to longest-prefix routing.

---

## Step 2 — Frontend plumbing

### 2a. Install packages

```bash
pnpm add @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-collaboration @tiptap/extension-collaboration-caret \
  @tiptap/extension-placeholder yjs
```

Optionally remove unused: `codemirror`, `vue-codemirror`, `@codemirror/lang-markdown`.

### 2b. Create `src/collaboration/WebSocketProvider.ts`

Custom binary WebSocket provider matching the backend protocol. See integration doc section 3.

Key points:
- `synced` flag: first server message is raw (no tag byte), subsequent are tagged
- Outgoing: `[0x00][update]` for sync, `[0x01][encoded]` for awareness
- Public `awareness` property (CollaborationCaret reads it)
- Exponential backoff reconnect (1s-30s)

### 2c. Create `src/composables/useCollaboration.ts`

Composable that owns `ydoc`, `yContent`, `yTitle`, `awareness`, `provider`. See integration doc section 4.

Key points:
- `yContent = ydoc.getXmlFragment("content")`, `yTitle = ydoc.getText("title")`
- Reactive `titleText` ref mirrored from `yTitle.observe()`
- SSR guard: `if (typeof window === "undefined")` skip creation
- `onUnmounted`: disconnect + `ydoc.destroy()`

---

## Step 3 — Components: build new, rewrite existing, delete dead code

### New files

| File | What |
|---|---|
| `src/components/ClientOnly.vue` | SSR guard — renders slot after `onMounted`, fallback on server |
| `src/components/notes/CollabEditor.vue` | Tiptap editor bound to `Y.XmlFragment` via Collaboration extension |
| `src/components/notes/CollabTitle.vue` | `<InputText>` bound to `Y.Text` via `yTitle.delete()`/`insert()` |

### Rewrite

| File | Change |
|---|---|
| `NoteEdit.vue` | Replace Textarea/InputText/Save with CollabEditor/CollabTitle/Close. Use `useCollaboration()` instead of `editStore`. Wrap editor in `<ClientOnly>`. |
| `NoteDisplay.vue` | Accept note as prop, display `title_preview`/`content_preview`. Stop using `editStore`. |
| `NotesView.vue` | Fix edit/display toggle. New-note flow: POST -> select -> WS connect. |
| `types.ts` | `Note` interface: UUID `id`, `title_preview`, `content_preview`, timestamps. |
| `noteStore.ts` | Remove `editNote()`. Update types to match `NoteSummary` (UUID, previews). |

### Delete

| File | Why |
|---|---|
| `editStore.ts` | Replaced by `useCollaboration` composable |
| `NoteCreateForm.vue` | Already unused |
