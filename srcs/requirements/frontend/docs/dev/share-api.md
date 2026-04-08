# Share / Collaboration API — Frontend Integration Guide

> Supersedes `invitation-api.md`. The backend is implemented on the `share` branch (now merged).

## Overview

Sharing lets a note owner grant other users access to a note. The flow has two services:

1. **Auth service** — resolves a human-readable identifier (email/username) to a UUID.
2. **Notes service** — manages share records (create, list, access, revoke).

All endpoints use cookie-based session auth. Nginx verifies the session via `auth_request` and injects the `X-User-Id` header. No JWT.

---

## Auth Service Endpoints

### Resolve user for sharing

```
GET /api/user/resolve?identifier=<loginName or email>
```

Exact match only — no prefix search or autocomplete. Minimum 3 characters.

**200 OK**
```json
{
  "user": {
    "id": "uuid-string",
    "loginName": "username",
    "imageURL": "optional-avatar-url-or-null"
  }
}
```

**404 Not Found**
```json
{ "error": "No user found with that email or username." }
```

### List all users

```
GET /api/user/users
```

Returns all registered users (id + loginName). Useful for populating a user picker.

---

## Notes Service — Collaboration Endpoints

All routes are under `/api/notes/collab/`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notes/collab/received` | Notes others have shared with me |
| `GET` | `/api/notes/collab/created` | All shares I have created |
| `GET` | `/api/notes/collab/{note_id}` | Collaborators on a specific note |
| `POST` | `/api/notes/collab/` | Create a share |
| `GET` | `/api/notes/collab/access/{share_id}` | Open a note via share link |
| `DELETE` | `/api/notes/collab/revoke/{share_id}` | Revoke a share (owner only) |

### Response Types

**ReceivedShareItem** — returned by `GET /collab/received`
```json
{
  "share_id": "uuid",
  "note_id": "uuid",
  "note_title": "Meeting Notes",
  "role": "View" | "Edit",
  "owner_id": "uuid",
  "created_at": "2026-04-08T..."
}
```

**ManagedShareItem** — returned by `GET /collab/created` and `GET /collab/{note_id}`
```json
{
  "share_id": "uuid",
  "note_id": "uuid",
  "note_title": "Meeting Notes",
  "guest_id": "uuid | null",
  "role": "View" | "Edit",
  "created_at": "2026-04-08T..."
}
```

**Share** — returned by `POST /collab/`
```json
{
  "id": "uuid",
  "note_id": "uuid",
  "guest_id": "uuid | null",
  "role": "View" | "Edit",
  "created_at": "2026-04-08T...",
  "updated_at": "2026-04-08T..."
}
```

---

## Endpoint Details

### Create a share

```
POST /api/notes/collab/
```

**Request body**
```json
{
  "note_id": "uuid",
  "guest_id": "uuid | null",
  "role": "View" | "Edit"
}
```

- `guest_id: null` creates a **public link** (anyone with the share_id can access).
- `guest_id: "uuid"` creates a **private share** for that specific user.
- Only the note owner can create shares.
- Duplicate shares return **409 Conflict** (DB constraint: `UNIQUE NULLS NOT DISTINCT (note_id, guest_id)`).

**Responses:** `200` Share object, `403` not the owner, `404` note not found, `409` duplicate.

### Open a shared note

```
GET /api/notes/collab/access/{share_id}
```

Returns the full Note object. Access is granted if the requester is the owner, the named guest, or the share is public.

**Responses:** `200` Note, `404` share not found or no permission.

### Revoke a share

```
DELETE /api/notes/collab/revoke/{share_id}
```

Owner only. Returns `204 No Content` on success, `404` if share not found or not the owner.

---

## Notes Service — Slug Endpoint

```
GET /api/notes/u/{slug}
```

Fetch a note by its `owner_url` slug (e.g., `/api/notes/u/meeting-notes`). Owner only. Slugs are auto-generated from the note title on create/update.

---

## Frontend Integration Flow

### Sharing a note with a specific user

1. User types a loginName or email into the share input (min 3 chars).
2. Debounce ~250ms, then call `GET /api/user/resolve?identifier=<input>`.
3. On success: show user preview (avatar, name). Enable "Share" button.
4. On 404: show "No user found." Keep "Share" disabled.
5. On confirm: `POST /api/notes/collab/` with `{ note_id, guest_id: resolved_uuid, role }`.
6. On 409: show "This user already has access."

### Creating a public link

Same as above but with `guest_id: null`. On 409: "A public link already exists."

### Listing shared notes (sidebar)

- Own notes: `GET /api/notes` (existing)
- Shared with me: `GET /api/notes/collab/received`

Render shared notes in a separate "Shared with me" section.

### Managing shares (owner view)

- All my shares: `GET /api/notes/collab/created`
- Per-note collaborators: `GET /api/notes/collab/{note_id}`
- Revoke: `DELETE /api/notes/collab/revoke/{share_id}`

---

## Frontend Files to Modify

| File | Change needed |
|------|--------------|
| `app/stores/noteStore.ts` | Add shared notes fetch, share CRUD actions |
| `app/pages/Notes.vue` | Add "Shared with me" sidebar section |
| `app/components/notes/ShareDialog.vue` | Wire up resolve + create share (exists on share branch) |
| `app/composables/useCollaboration.ts` | May need updates for shared note WebSocket access |

## Key Rules

1. The Notes service only stores UUIDs. Human-readable names must be resolved through Auth.
2. `share_id` is the single key for both opening (`access/`) and revoking (`revoke/`).
3. `role` is `"View"` or `"Edit"` (case-sensitive, matches Rust enum).
4. Avatar display: use `imageURL` if set, otherwise seed `UserAvatar.vue` with `user.id`.
