//WHAT REMAINS OF THE REST API//

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use std::sync::Arc;
use uuid::Uuid;
use yrs::{Doc, ReadTxn, StateVector, Text, Transact, XmlFragment};

use crate::models::{CreateNote, Note, NoteSummary};
use crate::sync::AppState;

pub async fn get_all_notes(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<NoteSummary>>, StatusCode> {
    let notes = sqlx::query_as::<_, NoteSummary>(
        "SELECT id, title_preview, content_preview, created_at, updated_at FROM notes",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(notes))
}

pub async fn get_note(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Note>, StatusCode> {
    let note = sqlx::query_as::<_, Note>(
        "SELECT id, doc_state, created_at, updated_at, title_preview, content_preview \
         FROM notes WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match note {
        Some(note) => Ok(Json(note)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_note(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateNote>,
) -> Result<(StatusCode, Json<NoteSummary>), StatusCode> {
    let doc_state = {
        let doc = Doc::new();
        let title_text = doc.get_or_insert_text("title");
        let _content_frag = doc.get_or_insert_xml_fragment("content");
        {
            let mut txn = doc.transact_mut();
            if let Some(ref t) = payload.title {
                title_text.insert(&mut txn, 0u32, t.as_str());
            }
            // content starts empty — Tiptap populates the XmlFragment via WebSocket
        }
        doc.transact()
            .encode_state_as_update_v1(&StateVector::default())
    };

    let note = sqlx::query_as::<_, NoteSummary>(
        "INSERT INTO notes (doc_state, title_preview, content_preview, owner_id) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, title_preview, content_preview, created_at, updated_at",
    )
    .bind(&doc_state)
    .bind(&payload.title)
    .bind(&payload.content)
    .bind(&payload.owner_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(note)))
}

pub async fn delete_note(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM notes WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
