use axum::{extract::{State, Path}, http::StatusCode, Json};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Note, CreateNote};

pub async fn get_all_notes(State(pool): State<PgPool>) -> Result<Json<Vec<Note>>, StatusCode> {
	let notes = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, created_at, updated_at FROM notes")
		.fetch_all(&pool)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	Ok(Json(notes))
}

pub async fn get_note(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<Json<Note>, StatusCode> {
	let note = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, created_at, updated_at FROM notes WHERE id = $1")
		.bind(id)
		.fetch_optional(&pool)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => Err(StatusCode::NOT_FOUND),
	}
}

// more logic required since with post note technically note_state in the db has to be created as well
pub async fn post_note(State(pool): State<PgPool>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	// using transaction to write savely
	let mut tx = pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	// metadata
	let note = sqlx::query_as::<_, Note>(
		"INSERT INTO notes (title) VALUES ($1) RETURNING id, title, owner_id, created_at, updated_at",
	)
	.bind(&payload.title)
	.fetch_one(&mut *tx)
	.await
	.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	// declare empty CRDT-state - hardcoded maybe change later? 
	// But it allows for editor service to only ever edit and not create, which is nice
	sqlx::query("INSERT INTO note_states (note_id, state_vector) VALUES ($1, $2)")
		.bind(note.id)
		.bind(&[0u8, 0u8][..]) 
		.execute(&mut *tx)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	Ok(Json(note))
}

pub async fn del_note(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<StatusCode, StatusCode> {
	let result = sqlx::query("DELETE FROM notes WHERE id = $1")
		.bind(id)
		.execute(&pool)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	if result.rows_affected() == 0 {
		return Err(StatusCode::NOT_FOUND);
	}

	Ok(StatusCode::NO_CONTENT)
}

pub async fn edit_title(State(pool): State<PgPool>, Path(id): Path<Uuid>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	let note = sqlx::query_as::<_, Note>(
		"UPDATE notes SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, owner_id, created_at, updated_at"
		)
		.bind(payload.title)
		.bind(id)
		.fetch_optional(&pool)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => Err(StatusCode::NOT_FOUND),
	}
}