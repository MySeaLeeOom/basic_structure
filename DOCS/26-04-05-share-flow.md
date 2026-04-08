## Frontend Share Flow (April 2026)

### 1. Creating a Share
- **UI Element**: A "Share" button on the note interface.
- **Action**: Opens a modal/dialog to specify sharing details.
- **Inputs**: 
  - `loginName` or `email` of the user to share with (typed by the owner). Leave blank/null for a public link.
  - `role` (Dropdown/Radio: `View` or `Edit`).
- **Two-step process**:
  1. Resolve the typed identifier to a UUID via the Auth service.
  2. POST to the Notes service with `note_id`, `guest_id` (UUID), and `role`.
- **API Call**: `POST /api/notes/collab/` with body `{ note_id, guest_id, role }`.

### 2. Deleting/Revoking a Share
- **UI Element**: A list of active shares in the sharing modal.
- **Action**: A "Revoke" button next to each share entry.
- **API Call**: `DELETE /api/notes/collab/revoke/{share_id}` — only the note owner can do this.

### 3. Error Handling: Duplicate Shares
- **Scenario**: Sharing with a user who already has access, or generating a second public link.
- **Backend Response**: HTTP `409 Conflict` (DB constraint: `UNIQUE NULLS NOT DISTINCT (note_id, guest_id)`).
- **Frontend Action**: 
  - Catch the `409` status code.
  - Display a friendly error message: "This user already has access to this note" or "A public link already exists for this note."
  - Optionally, highlight the existing share in the UI instead of crashing.


TODO: generate note url_path thing for each note - did we already do this/

---

### Identity Resolution & Search Strategy

To share a note with a specific person, the frontend must first convert a "human-readable" identifier (like an email or username) into a UUID that our backend can process.

#### The API Call
**Endpoint**: `GET /api/user/resolve?identifier=<input>`  
**Service**: Auth Service  
**Minimum length**: 3 characters (enforced by the backend schema).

**Important**: This is an **exact match** lookup — it does not do prefix search or autocomplete.  
The identifier must be the user's full `loginName` **or** full `email`. Partial strings return 404.

### Notes Service Endpoints (implemented)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notes/collab/received` | Notes others have shared with me |
| `GET` | `/api/notes/collab/created` | All shares I have created |
| `GET` | `/api/notes/collab/{note_id}` | Collaborators on a specific note |
| `POST` | `/api/notes/collab/` | Create a share `{ note_id, guest_id, role }` |
| `GET` | `/api/notes/collab/access/{share_id}` | Open a note via share link |
| `DELETE` | `/api/notes/collab/revoke/{share_id}` | Revoke a share (owner only) |

A note is visible via share link if: the requester is the owner, OR is the named guest, OR the share is public (`guest_id IS NULL`).

---

**Response (Found - 200 OK)**:
```json
{
  "user": {
    "id": "uuid-string",
    "loginName": "username",
    "imageURL": "optional-avatar-url-or-null"
  }
}
```

**Response (Not Found - 404)**:
```json
{ "error": "No user found with that email or username." }
```

#### Frontend Implementation Workflow
1. User types a full `loginName` or `email` into a "Share with..." input (min 3 chars).
2. **Debounce** — wait ~250ms after the user stops typing before firing the request.
3. Call `GET /api/user/resolve?identifier=<input>`.
4. **Success**: Show a preview card with `UserAvatar.vue` (uses `user.id` as seed if no `imageURL`). Enable the "Share" button.
5. **Failure (404)**: Show "No user found." Keep "Share" disabled.
6. **On confirm**: POST to the Notes service with the resolved `user.id` as `guest_id`.

#### Avatar Display Priority
1. `user.imageURL` is set → render `<img>` tag.
2. `user.imageURL` is null → render `UserAvatar.vue` seeded by `user.id` (UUID → triadic color palette + pixel pattern).


Initial Notes:

```
Public Link / Private LInk
Array of View Users?
Array of Edit Users? 

Simplest Implementation - user has to exist, has all permissions to edit

Public for Registered Users

Share Link -> person clicks, see the note and can edit

Left hand side ()


FEATURE REQUEST: Projects
POLISH: Editor 
COLLAB: Link
```

---