use axum::http::StatusCode;
use uuid::Uuid;
use yrs::{Doc, ReadTxn, StateVector, Transact, Update, updates::decoder::Decode};

pub(super) async fn load_note_doc(pool: &sqlx::PgPool, note_id: Uuid) -> Result<Doc, ()> {
    let existing_state =
        sqlx::query_scalar::<_, Vec<u8>>("SELECT doc_state FROM notes WHERE id = $1")
            .bind(note_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| ())?
            .ok_or(())?;

    let doc = Doc::new();
    {
        let mut txn = doc.transact_mut();
        let existing_update = Update::decode_v1(&existing_state).map_err(|_| ())?;
        txn.apply_update(existing_update);
    }
    Ok(doc)
}

pub(super) async fn persist_note_update(
    pool: &sqlx::PgPool,
    note_id: Uuid,
    update_bytes: &[u8],
) -> Result<(), StatusCode> {
    let existing_state =
        sqlx::query_scalar::<_, Vec<u8>>("SELECT doc_state FROM notes WHERE id = $1")
            .bind(note_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;

    let incoming_update = Update::decode_v1(update_bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    let new_state = {
        let doc = Doc::new();
        {
            let mut txn = doc.transact_mut();
            let existing_update = Update::decode_v1(&existing_state)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            txn.apply_update(existing_update);
            txn.apply_update(incoming_update);
        }
        doc.transact()
            .encode_state_as_update_v1(&StateVector::default())
    };

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("UPDATE notes SET doc_state = $1, updated_at = NOW() WHERE id = $2")
        .bind(&new_state)
        .bind(note_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("INSERT INTO note_updates (note_id, update_data) VALUES ($1, $2)")
        .bind(note_id)
        .bind(update_bytes)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(())
}
