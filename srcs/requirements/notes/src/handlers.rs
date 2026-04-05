use axum::{extract::{State, Path}, http::HeaderMap, http::StatusCode, Json};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Note, CreateNote};

pub fn get_user_id(headers: &HeaderMap) -> Result<Uuid, StatusCode> {
	headers.get("X-User-Id")
		.and_then(|v| v.to_str().ok())
		.and_then(|v| Uuid::parse_str(v).ok())
		.ok_or(StatusCode::UNAUTHORIZED)
}

pub async fn get_all_notes(State(pool): State<PgPool>, headers: HeaderMap) -> Result<Json<Vec<Note>>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::debug!("Fetching all notes for user {}", user_id);
	let notes = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, owner_url, created_at, updated_at FROM notes WHERE owner_id = $1")
		.bind(user_id)
		.fetch_all(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch notes: {}", e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	Ok(Json(notes))
}

pub async fn get_note(State(pool): State<PgPool>, Path(id): Path<Uuid>, headers: HeaderMap) -> Result<Json<Note>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::debug!("Fetching note {} for user {}", id, user_id);
	let note = sqlx::query_as::<_, Note>("SELECT id, title, owner_id, owner_url, created_at, updated_at FROM notes WHERE id = $1 AND owner_id = $2")
		.bind(id)
		.bind(user_id)
		.fetch_optional(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to fetch note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?; 

	match note {
		Some(note) => Ok(Json(note)),
		None => {
			tracing::warn!("Note {} not found for user {}", id, user_id);
			Err(StatusCode::NOT_FOUND)
		}
	}
}

pub async fn post_note(State(pool): State<PgPool>, headers: HeaderMap, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::info!("Creating new note: {} for user {}", payload.title, user_id);
	
	let mut tx = pool.begin().await.map_err(|e| {
		tracing::error!("Failed to begin transaction: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

    // Generate a unique slug for the owner_url
    let slug = generate_unique_slug(&mut *tx, user_id, &payload.title, None).await.map_err(|e| {
        tracing::error!("Failed to generate unique slug: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

	let note = sqlx::query_as::<_, Note>(
		"INSERT INTO notes (title, owner_id, owner_url) VALUES ($1, $2, $3) RETURNING id, title, owner_id, owner_url, created_at, updated_at",
	)
	.bind(&payload.title)
	.bind(user_id)
    .bind(&slug)
	.fetch_one(&mut *tx)
	.await
	.map_err(|e| {
		tracing::error!("Failed to insert note: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

	// Valid empty yrs state vector (v1)
	let empty_state = vec![0u8, 0u8];
	
	sqlx::query("INSERT INTO note_states (note_id, state_vector) VALUES ($1, $2)")
		.bind(note.id)
		.bind(&empty_state) 
		.execute(&mut *tx)
		.await
		.map_err(|e| {
			tracing::error!("Failed to insert note state: {}", e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	tx.commit().await.map_err(|e| {
		tracing::error!("Failed to commit transaction: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

	tracing::info!("Note {} created successfully", note.id);
	Ok(Json(note))
}

pub async fn del_note(State(pool): State<PgPool>, Path(id): Path<Uuid>, headers: HeaderMap) -> Result<StatusCode, StatusCode> {
	let user_id = get_user_id(&headers)?;
	tracing::info!("Deleting note {} for user {}", id, user_id);
	let result = sqlx::query("DELETE FROM notes WHERE id = $1 AND owner_id = $2")
		.bind(id)
		.bind(user_id)
		.execute(&pool)
		.await
		.map_err(|e| {
			tracing::error!("Failed to delete note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?;

	if result.rows_affected() == 0 {
		tracing::warn!("Note {} not found for deletion (or not owned by user)", id);
		return Err(StatusCode::NOT_FOUND);
	}

	tracing::info!("Note {} deleted successfully", id);
	Ok(StatusCode::NO_CONTENT)
}

pub async fn edit_title(State(pool): State<PgPool>, Path(id): Path<Uuid>, headers: HeaderMap, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
	let user_id = get_user_id(&headers)?;

	tracing::info!("Updating title for note {}: {}", id, payload.title);
	
	let mut tx = pool.begin().await.map_err(|e| {
		tracing::error!("Failed to begin transaction: {}", e);
		StatusCode::INTERNAL_SERVER_ERROR
	})?;

    let slug = generate_unique_slug(&mut *tx, user_id, &payload.title, Some(id)).await.map_err(|e| {
        tracing::error!("Failed to generate unique slug for update: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

	let note = sqlx::query_as::<_, Note>(
		"UPDATE notes SET title = $1, owner_url = $2, updated_at = NOW() WHERE id = $3 AND owner_id = $4 RETURNING id, title, owner_id, owner_url, created_at, updated_at"
		)
		.bind(&payload.title)
        .bind(&slug)
		.bind(id)
		.bind(user_id)
		.fetch_optional(&mut *tx)
		.await
		.map_err(|e| {
			tracing::error!("Failed to update note {}: {}", id, e);
			StatusCode::INTERNAL_SERVER_ERROR
		})?; 

	match note {
		Some(note) => {
			tx.commit().await.map_err(|e| {
				tracing::error!("Failed to commit transaction: {}", e);
				StatusCode::INTERNAL_SERVER_ERROR
			})?;
			tracing::info!("Note {} updated successfully", id);
			Ok(Json(note))
		},
		None => {
			tracing::warn!("Note {} not found for update", id);
			Err(StatusCode::NOT_FOUND)
		}
	}
}

pub fn slugify(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub async fn generate_unique_slug(
    tx: &mut sqlx::PgConnection,
    owner_id: Uuid,
    title: &str,
    exclude_id: Option<Uuid>
) -> Result<String, sqlx::Error> {
    let base_slug = slugify(title);
    let mut slug = base_slug.clone();
    let mut count = 1;

    loop {
        // Build the query string dynamically to avoid duplicate query logic
        let mut query = String::from("SELECT EXISTS(SELECT 1 FROM notes WHERE owner_id = $1 AND owner_url = $2");
        if exclude_id.is_some() {
            query.push_str(" AND id != $3");
        }
        query.push_str(")");

        let mut q = sqlx::query_scalar::<_, bool>(&query)
            .bind(owner_id)
            .bind(&slug);

        if let Some(id) = exclude_id {
            q = q.bind(id);
        }

        if !q.fetch_one(&mut *tx).await? {
            break;
        }

        slug = format!("{}-{}", base_slug, count);
        count += 1;
    }

    Ok(slug)
}
