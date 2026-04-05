# API Overview - Share Flow & Foundation

This document details the available endpoints in the **Auth** and **Notes** services as of April 5, 2026. This is the source of truth for frontend integration.

---

## Auth Service (`/api/auth` or `auth:3000`)
The Auth service manages identity, sessions, and the new User Resolution flow used for sharing.

| Method | Endpoint | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| **POST** | `/register` | Create a new account | `{ "loginName", "email", "password" }` |
| **POST** | `/login` | Start a session | `{ "identifier", "password" }` |
| **POST** | `/logout` | End session | N/A |
| **GET** | `/me` | Get current user profile | N/A |
| **GET** | `/resolve` | **[New]** Lookup user ID by email/login | `?identifier=masha` |
| **GET**| `/verify` | Internal Nginx session check | N/A |
| **PATCH** | `/change-login`| Update username | `{ "loginName" }` |
| **PATCH** | `/change-email`| Update email | `{ "email" }` |
| **POST**| `/change-password`| Update password | `{ "oldPassword", "newPassword" }` |

---

## Notes Service (`/api/notes` or `notes:3003`)
The Notes service handles CRUD for documents and the relational logic for sharing permissions.

### Standard Note Management
| Method | Endpoint | Description | Payload |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/notes` | List all notes owned by the user | N/A |
| **POST** | `/api/notes` | Create a new empty note | N/A |
| **GET** | `/api/notes/{id}` | Fetch a specific note (Markdown) | N/A |
| **PUT** | `/api/notes/{id}` | Update a note's title | `{ "title": "New Title" }` |
| **DELETE**| `/api/notes/{id}` | Permanently delete a note | N/A |

### Sharing & Collaboration
| Method | Endpoint | Description | Purpose |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/notes/shared/` | List notes shared BY OTHERS with me | "Shared with me" view |
| **GET** | `/api/shares/managed` | **[New]** List all shares I have created | "Manage Shares" view |
| **POST** | `/api/notes/shared/{id}` | Share a note with a guest user | Payload: `{ "guest_id", "role" }` |
| **GET** | `/api/notes/shared/{id}` | Access a note via share permissions | For Guest access |
| **DELETE**| `/api/notes/shared/{id}` | Revoke a share (remove guest access) | Payload: `{ "guest_id" }` |

---

## Integration Truths
1. **User Discovery**: Before sharing, the frontend **must** call Auth `/resolve?identifier=...` to get the `guest_id` (UUID).
2. **Identity**: The Notes service does not know usernames; it only stores UUIDs. All human-readable names must be resolved through the Auth service or the `/api/shares/managed` aggregate endpoint.
3. **Public Links**: Sharing with a `null` or empty `guest_id` creates a public link.
4. **Permissions**: The `role` in the share payload currently supports `"view"` or `"edit"`.
