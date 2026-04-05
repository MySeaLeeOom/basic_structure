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
## Frontend Share Flow Notes (April 5, 2026)

### 1. Creating a Share
- **UI Element**: A "Share" button on the note interface.
- **Action**: Opens a modal/dialog to specify sharing details.
- **Inputs**: 
  - `guest_id` (UUID of the user to share with, or empty/null for a public link).
  - `role` (Dropdown/Radio: 'View' or 'Edit').
- **API Call**: POST request to the note sharing endpoint (`/share` or similar) with `note_id`, `guest_id`, and `role`.

### 2. Deleting/Revoking a Share
- **UI Element**: A list of active shares in the sharing modal.
- **Action**: A "Revoke" or "Delete" button next to each active share (or the public link).
- **API Call**: DELETE request to remove the specific share record.

### 3. Error Handling: Duplicate Shares
- **Scenario**: The user tries to share a note with someone who already has access, or tries to generate a second public link.
- **Backend Response**: The API will return a HTTP 409 Conflict (due to the `UNIQUE NULLS NOT DISTINCT (note_id, guest_id)` DB constraint).
- **Frontend Action**: 
  - Catch the `409` status code.
  - Display a friendly error message: "This user already has access to this note" or "A public link already exists for this note."
  - Optionally, highlight the existing share in the UI instead of crashing.


TODO: generate note url_path thing for each note - did we already do this/

---

### Identity Resolution & Search Strategy

To share a note with a specific person, the frontend must first convert a "human-readable" identifier (like an email or username) into a UUID that our backend can process.

#### 1. The Strategy: Search Debouncing
To make the search feel "instant" like GitHub or Discord without overwhelming the Auth service:
- **Concept**: Use **Debouncing**. Do not send a network request for every single character typed.
- **Rule**: Wait for the user to stop typing for a short window (e.g., 250ms). If they type more before the timer is up, reset the timer.
- **Why**: This ensures that if someone types "masha" quickly, we only send **one** request instead of five (one for "m", "ma", "mas", etc.).

#### 2. The API Call: Identity Resolution
**Endpoint**: `GET /api/user/resolve?identifier=<input>`  
**Service**: Auth Service  

**Request**:
- `GET` with query parameter: `identifier` (The email or username typed by the user).

**Response (Found - 200 OK)**:
```json
{
  "user": {
    "id": "uuid-string",
    "loginName": "username",
    "imageURL": "optional-avatar-link"
  }
}
```

**Response (Not Found - 404)**:
```json
{
  "error": "No user found with that email or username."
}
```

#### 3. Visual Identity Fallback (Identity vs. URL)
When displaying a user profile image (in the search results or the share list), we follow a strict **Priority Hierarchy**:
1. **GitHub/Manual URL**: If `user.imageURL` exists, render the `<img>` tag.
2. **Generative Identity**: If `user.imageURL` is `null` or empty, use the `UserAvatar.vue` component to generate a pixelated SVG seeded by the `user.id` (UUID).
3. **Logic**: The `id` acts as the "DNA" seed for a triadic color palette ($0^\circ, 30^\circ, 180^\circ$) and symmetrical pixel pattern. 

#### 4. Frontend Implementation Workflow
1. User enters text in a "Share with user..." input field.
2. The **Debouncing** logic waits for a pause in typing. (minimum 3 characters)
3. On pause, the frontend calls `GET /resolve`.
4. **Success**: Render `UserAvatar.vue` with the returned `id` and `imageURL`. Show the preview card.
5. **Failure**: Show a "No user found" message. Keep the "Share" button disabled.
6. **Execution**: When "Share" is clicked, send the `user.id` to the Notes Service sharing endpoint.

