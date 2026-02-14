use axum::{extract::{State, Path}, http::StatusCode, Json, body::Bytes};
use sqlx::PgPool;
use crate::models::{Note, NoteSummary, CreateNote};
use yrs::{Doc, ReadTxn, StateVector, Transact, Update, updates::decoder::Decode};
use uuid::Uuid;

pub async fn get_all_notes(State(pool): State<PgPool>) -> Result<Json<Vec<NoteSummary>>, StatusCode> {
	let notes = sqlx::query_as::<_, NoteSummary>(
		"SELECT id, title_preview, content_preview, created_at, updated_at FROM notes"
	)
	.fetch_all(&pool)
	.await
	.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	Ok(Json(notes))
}

pub async fn get_note(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<Json<Note>, StatusCode> {
	let note = sqlx::query_as::<_, Note>(
		"SELECT id, doc_state, created_at, updated_at, title_preview, content_preview FROM notes WHERE id = $1"
	)
	.bind(id)
	.fetch_optional(&pool)
	.await
	.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	match note {
		Some(note) => Ok(Json(note)),
		None => Err(StatusCode::NOT_FOUND),
	}
}

pub async fn create_note(State(pool): State<PgPool>, Json(payload): Json<CreateNote>) -> Result<(StatusCode, Json<NoteSummary>), StatusCode> {
	let doc = Doc::new();
	let title_text = doc.get_or_insert_text("title");
	let content_text = doc.get_or_insert_text("content");
	{
		let mut txn = doc.transact_mut();
		if let Some(ref t) = payload.title {
			title_text.insert(&mut txn, 0, t);
		}
		if let Some(ref c) = payload.content {
			content_text.insert(&mut txn, 0, c);
		}
	}
	let doc_state = doc.transact().encode_state_as_update_v1(&StateVector::default());

	let note = sqlx::query_as::<_, NoteSummary>(
		"INSERT INTO notes (doc_state, title_preview, content_preview, owner_id) \
		 VALUES ($1, $2, $3, $4) \
		 RETURNING id, title_preview, content_preview, created_at, updated_at"
	)
	.bind(&doc_state)
	.bind(&payload.title)
	.bind(&payload.content)
	.bind(&payload.owner_id)
	.fetch_one(&pool)
	.await
	.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

	Ok((StatusCode::CREATED, Json(note)))
}

pub async fn delete_note(State(pool): State<PgPool>, Path(id): Path<Uuid>) -> Result<StatusCode, StatusCode> {
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