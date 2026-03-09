# Note Version History — Implementation Reference

This document captures all code pieces needed to support **saving note versions (snapshot history)** across frontend, notes service, and Postgres.

## What this feature does

- Allows frontend to explicitly save a snapshot of note content.
- Persists snapshots in Postgres table `note_versions`.
- Exposes backend APIs to create and list note versions.

---

## 1) Postgres schema

### File
- `srcs/requirements/postgres/init/02-init.sql`

### Required SQL

```sql
-- the history - the "Commits" or "Snapshots"
CREATE TABLE IF NOT EXISTS note_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);
```

---

## 2) Notes service API model types

### File
- `srcs/requirements/notes/src/models.rs`

### Required Rust types

```rust
#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct NoteVersion {
    pub id: Uuid,
    pub note_id: Uuid,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateSnapshot {
    pub content: String,
}
```

---

## 3) Notes service routes

### File
- `srcs/requirements/notes/src/main.rs`

### Required route

```rust
.route("/api/notes/{id}/versions", post(handlers::post_snapshot).get(handlers::get_versions))
```

This adds:
- `POST /api/notes/{id}/versions` → create snapshot
- `GET /api/notes/{id}/versions` → list snapshot history

---

## 4) Notes service handlers

### File
- `srcs/requirements/notes/src/handlers.rs`

### Required handlers

```rust
pub async fn post_snapshot(State(pool): State<PgPool>, Path(id): Path<Uuid>, Json(payload): Json<crate::models::CreateSnapshot>) -> Result<Json<crate::models::NoteVersion>, StatusCode> {
    tracing::info!("Creating snapshot for note {}", id);

    let version = sqlx::query_as::<_, crate::models::NoteVersion>(
        "INSERT INTO note_versions (note_id, content) VALUES ($1, $2) RETURNING id, note_id, content, created_at"
    )
    .bind(id)
    .bind(payload.content)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to save snapshot for note {}: {}", id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(version))
}

pub async fn get_versions(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<Json<Vec<crate::models::NoteVersion>>, StatusCode> {
    let versions = sqlx::query_as::<_, crate::models::NoteVersion>(
        "SELECT id, note_id, content, created_at FROM note_versions WHERE note_id = $1 ORDER BY created_at DESC"
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch versions for note {}: {}", id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(versions))
}
```

---

## 5) Frontend API store call

### File
- `srcs/requirements/frontend/src/stores/noteStore.ts`

### Required method

```ts
async function saveSnapshot(id: string, content: string) {
	error.value = null;
	try {
		const response = await fetch(`/api/notes/${id}/versions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		});

		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return await response.json();
	} catch (catchError) {
		const errorMsg = catchError instanceof Error ? catchError.message : "Snapshot failed";
		error.value = errorMsg;
		console.error("Failed to save snapshot:", errorMsg);
		throw catchError;
	}
}
```

Also export it from the store return object:

```ts
saveSnapshot,
```

---

## 6) Frontend editor save flow

### File
- `srcs/requirements/frontend/src/stores/editStore.ts`

### Required save integration

```ts
async function save() {
	if (!noteStore.selectedNote) return;

	// 1. Title Meta Save (REST)
	if (draftTitle.value !== noteStore.selectedNote.title) {
		await noteStore.updateTitle(noteStore.selectedNote.id, draftTitle.value);
	}

	// 2. Explicit Snapshot Save (Commit/Push)
	// This creates a permanent row in note_versions table
	try {
		await noteStore.saveSnapshot(noteStore.selectedNote.id, draftContent.value);
		isDirty.value = false;
		lastSaved.value = new Date();
	} catch (e) {
		console.error("Save snapshot failed, but Yjs might have synced it anyway.", e);
	}
}
```

---

## End-to-end request flow

1. User clicks Save in frontend editor.
2. Frontend calls `saveSnapshot(noteId, content)`.
3. Request goes to `POST /api/notes/{id}/versions`.
4. Notes service inserts row into `note_versions`.
5. Snapshot row is returned to client.

---

## Optional next step (not implemented in this reference)

- Add frontend UI to fetch and display versions with:
  - `GET /api/notes/{id}/versions`
  - version dropdown/list
  - restore selected version into editor
