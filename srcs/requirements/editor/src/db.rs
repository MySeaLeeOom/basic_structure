use sqlx::PgPool;
use uuid::Uuid;
use yrs::{Doc, ReadTxn, StateVector, Transact, Update, updates::decoder::Decode};
use crate::models::SavedNoteState;
use base64::{Engine as _, engine::general_purpose};
use serde_json;

// loads state of a note from the database and applies it to a new yrs::Doc, which is then returned. This is called when a new client connects to load the current state of the document.
pub async fn load_note(pool: &PgPool, note_id: Uuid) -> Result<Doc, ()> {
	// get blob
	let result = sqlx::query_as::<_, SavedNoteState>(
		"SELECT state_vector FROM note_states WHERE note_id = $1"
	)
	.bind(note_id)
	.fetch_optional(pool)
	.await
	.map_err(|e| {
		tracing::error!("DB Error loading note {}: {}", note_id, e);
		()
	})?;

	let doc = Doc::new();

	// apply blob to doc
	if let Some(saved_state) = result {
		if !saved_state.state_vector.is_empty() {
			let mut txn = doc.transact_mut();
			match Update::decode_v1(&saved_state.state_vector) {
				Ok(update) => {
					txn.apply_update(update);
					tracing::debug!("Successfully applied saved state to note {}", note_id);
				}
				Err(e) => {
					tracing::error!("CRDT Decode Error for {}: {}", note_id, e);
					return Err(());
				}
			}
		}
	}

	Ok(doc)
}

// Fetch the owner of a note. Called once per room so that persistence and
// AI ingestion are always attributed to the owner, not to whichever user
// happens to be connected at save time.
pub async fn get_owner_id(pool: &PgPool, note_id: Uuid) -> Result<Uuid, ()> {
	sqlx::query_scalar::<_, Uuid>("SELECT owner_id FROM notes WHERE id = $1")
		.bind(note_id)
		.fetch_optional(pool)
		.await
		.map_err(|e| {
			tracing::error!("DB Error fetching owner for note {}: {}", note_id, e);
			()
		})?
		.ok_or_else(|| {
			tracing::error!("No owner found for note {}", note_id);
			()
		})
}

pub async fn check_access(pool: &PgPool, note_id: Uuid, user_id: Uuid) -> bool {
	// Owner OR shared guest (private share or public link)
	sqlx::query(
		"SELECT 1 FROM notes WHERE id = $1 AND owner_id = $2
		 UNION ALL
		 SELECT 1 FROM share WHERE note_id = $1 AND (guest_id = $2 OR guest_id IS NULL)
		 LIMIT 1"
	)
	.bind(note_id)
	.bind(user_id)
	.fetch_optional(pool)
	.await
	.map(|r| r.is_some())
	.unwrap_or(false)
}

pub async fn save_note(pool: &PgPool, note_id: Uuid, user_id: Uuid, doc: &Doc) -> Result<(), ()> {
	// get state vector as blob
	let state_blob = {
		let txn = doc.transact();
		txn.encode_state_as_update_v1(&StateVector::default())
	};

	// save to db
	sqlx::query(
		"UPDATE note_states SET state_vector = $1, last_saved_at = NOW() WHERE note_id = $2"
	)
	.bind(&state_blob)
	.bind(note_id)
	.execute(pool)
	.await
	.map_err(|e| {
		tracing::error!("DB Error saving note {}: {}", note_id, e);
		()
	})?;

	// AI Ingestion Hook
	let base64_blob = general_purpose::STANDARD.encode(&state_blob);
	let client = reqwest::Client::new();
	let ai_service_url = "http://ai-ingest:8002/ingest";
	
	let payload = serde_json::json!({
		"note_id": note_id,
		"user_id": user_id,
		"binary_data": base64_blob
	});

	// Fire and forget (don't block the editor save if AI is slow)
	tokio::spawn(async move {
		match client.post(ai_service_url).json(&payload).send().await {
			Ok(resp) => {
				if !resp.status().is_success() {
					tracing::warn!("AI Ingestion failed with status: {}", resp.status());
				}
			}
			Err(e) => tracing::error!("Failed to contact AI service: {}", e),
		}
	});

	tracing::info!("Successfully saved note {} and triggered ingestion", note_id);
	Ok(())
}
