use axum::{extract::{State, Path}, http::StatusCode, Json};
use sqlx::PgPool;
use crate::models::{Note, CreateNote};
use yrs::{Doc, Transact, updates::decoder::Decode};

pub async fn get_all_notes(State(pool): State<PgPool>) -> Result<Json<Vec<Note>>, StatusCode> {
	let notes = sqlx::query_as::<_, Note>("SELECT id, title, content FROM notes")
		.fetch_all(&pool)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	Ok(Json(notes))
}

pub async fn get_note(State(pool): State<PgPool>, Path(id): Path<i32>) -> Result<Json<Note>, StatusCode> {
	let note = sqlx::query_as::<_, Note>("SELECT id, title, content FROM notes WHERE id = $1")
		.bind(id)
		.fetch_optional(&pool)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => Err(StatusCode::NOT_FOUND),
	}
}

pub async fn post_note(State(pool): State<PgPool>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	let note = sqlx::query_as::<_, Note>(
		"INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING id, title, content",
	)
	.bind(payload.title)
	.bind(payload.content)
	.fetch_one(&pool)
	.await
	.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	Ok(Json(note))
}

pub async fn del_note(State(pool): State<PgPool>, Path(id): Path<i32>) -> Result<StatusCode, StatusCode> {
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

pub async fn edit_note(State(pool): State<PgPool>, Path(id): Path<i32>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	let note = sqlx::query_as::<_, Note>(
		"UPDATE notes SET title = $1, content = $2 WHERE id = $3 RETURNING id, title, content"
		)
		.bind(payload.title)
		.bind(payload.content)
		.bind(id)
		.fetch_optional(&pool)
		.await
		.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => Err(StatusCode::NOT_FOUND),
	}
}

pub async fn apply_update(
    State(pool): State<PgPool>,
    Path(note_id): Path<Uuid>,
    body: Bytes,
) -> Result<StatusCode, StatusCode> {
    // Decode the update
    let update = Update::decode_v1(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    let row = sqlx::query!("SELECT doc_state FROM notes WHERE id = $1", note_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

	
    let doc = Doc::new();
    {
        let mut txn = doc.transact_mut();
        txn.apply_update(Update::decode_v1(&row.doc_state).unwrap());
        txn.apply_update(update);
    }
    
    // Persist
    let new_state = doc.transact().encode_state_as_update_v1(&StateVector::default());
    sqlx::query!(
        "UPDATE notes SET doc_state = $1, updated_at = NOW() WHERE id = $2",
        new_state, note_id
    )
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Store incremental update for other clients
    sqlx::query!(
        "INSERT INTO note_updates (note_id, update_data) VALUES ($1, $2)",
        note_id, body.as_ref()
    )
    .execute(&pool)
    .await
    .ok();
    
    Ok(StatusCode::OK)
}