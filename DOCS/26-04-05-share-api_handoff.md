# API Overview - Share Flow & Foundation

This document details the available endpoints in the **Auth** and **Notes** services as of April 5, 2026. This is the source of truth for frontend integration.

---

## Auth Service (`/api/auth` or `auth:3000`)
The Auth service manages identity, sessions, and the new User Resolution flow used for sharing.

| Method | Endpoint | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| **GET** | `/resolve` | **[New]** Lookup user ID by email/login | `?identifier=masha` |
| **GET** | `/users` | List all registered users (id + loginName) | N/A |

| **GET** | `/me` | Get current user profile | N/A |
| **GET**| `/verify` | Internal Nginx session check | N/A |

| **POST** | `/register` | Create a new account | `{ "loginName", "email", "password" }` |
| **POST** | `/login` | Start a session | `{ "identifier", "password" }` |
| **POST** | `/logout` | End session | N/A |
| **PATCH** | `/change-login`| Update username | `{ "loginName" }` |
| **PATCH** | `/change-email`| Update email | `{ "email" }` |
| **POST**| `/change-password`| Update password | `{ "oldPassword", "newPassword" }` |

---

## Notes Service (`/api/notes` or `notes:3003`)
The Notes service handles CRUD for documents and the relational logic for sharing permissions.

### Data Models (Schema)

See [`srcs/requirements/notes/src/models.rs`](../srcs/requirements/notes/src/models.rs)

### Standard Note Management
| Method | Endpoint | Description | Payload | Return |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/notes` | List owned notes | N/A | `[Note, ...]` |
| **POST** | `/api/notes` | Create new empty note | N/A | `Note` |
| **GET** | `/api/notes/{id}` | Fetch a specific note | N/A | `Note` |
| **GET** | `/api/notes/u/{slug}` | Fetch a note by owner slug | N/A | `Note` |
| **PUT** | `/api/notes/{id}` | Update title | `EditTitlePayload` | `Note` |
| **DELETE** | `/api/notes/{id}` | Permanently delete a note | N/A | `204 No Content` |

### Collaboration
| Method | Endpoint | Description | Payload | Return |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/notes/collab/received` | Notes others have shared with me | N/A | `[SharedNoteInfo, ...]` |
| **GET** | `/api/notes/collab/created` | All shares I have created | N/A | `[ManagedShareItem, ...]` |
| **GET** | `/api/notes/collab/{note_id}` | Collaborators on a specific note | N/A | `[ManagedShareItem, ...]` |
| **POST** | `/api/notes/collab/` | Create a share | `ShareNotePayload` | `Share` |
| **GET** | `/api/notes/collab/access/{share_id}` | Open a note via share link | N/A | `Note` |
| **DELETE** | `/api/notes/collab/revoke/{share_id}` | Revoke a share | N/A | `204 No Content` |

### Routes
```
GET    /api/notes/collab/received           → notes others have shared with me
GET    /api/notes/collab/created            → all shares I have created
GET    /api/notes/collab/{note_id}          → collaborators on a specific note
POST   /api/notes/collab/                   → create a share  { note_id, guest_id, role }
GET    /api/notes/collab/access/{share_id}  → open a note via share link
DELETE /api/notes/collab/revoke/{share_id}  → revoke a share
```

---

## Integration Truths
1. **User Discovery**: Before sharing, the frontend **must** call Auth `/resolve?identifier=...` to get the `guest_id` (UUID).
2. **Identity**: The Notes service only stores UUIDs — no usernames. Human-readable names must be resolved through the Auth service.
3. **Public Links**: Sharing with a `null` `guest_id` creates a public link — anyone with the `share_id` can access it.
4. **Permissions**: `role` supports `"View"` or `"Edit"`.
5. **share_id is the single key**: it is returned on share creation and used for both opening (`access/`) and revoking (`revoke/`) a share.
