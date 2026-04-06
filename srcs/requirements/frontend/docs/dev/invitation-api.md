# Invitation Workflow — Backend API Requirements

The frontend has a working invitation UI on the Notes page. The following endpoints are needed to make it functional.

## Endpoints

### 1. `GET /api/users`

Returns all users available for invitation.

**Response** `200 OK`
```json
[
  { "name": "aydiler", "fullName": "Ahmet Diler" },
  { "name": "maahoff", "fullName": "Maarten Hoff" }
]
```

The frontend uses `name` as the unique identifier and displays `fullName` in the invite dialog.

---

### 2. `POST /api/notes/:noteId/invite`

Sends invitations to one or more users for a specific note.

**Request**
```json
{
  "usernames": ["maahoff", "pvasilan"]
}
```

**Response** `200 OK` on success.

Notes:
- The authenticated user (from session cookie) is the inviter
- Inviting a user who already has access should be a no-op (not an error)
- The `noteId` comes from the URL path

---

### 3. `GET /api/notes/shared`

Returns notes that have been shared with the authenticated user (i.e., notes owned by others where the current user was invited).

**Response** `200 OK`
```json
[
  {
    "id": "uuid",
    "title": "Meeting Notes",
    "owner_id": "other-user-uuid",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

Same shape as `GET /api/notes` (own notes). The frontend renders these in a separate "Shared with me" section in the sidebar.

---

## Frontend Files

| File | What to look for |
|------|-----------------|
| `srcs/requirements/frontend/app/pages/Notes.vue` | `TODO` comments mark all placeholder code |
| `srcs/requirements/frontend/app/stores/noteStore.ts` | Note CRUD logic, add shared notes fetch here |

## Auth

All endpoints use cookie-based session auth. Nginx verifies the session via `auth_request` and injects `X-User-Id` header. No JWT.
