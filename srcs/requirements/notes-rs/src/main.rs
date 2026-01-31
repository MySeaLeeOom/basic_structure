use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::net::SocketAddr;

#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct Note {
    id: i32,
    title: String,
    content: String,
}

#[derive(Deserialize)]
struct CreateNote {
    title: String,
    content: String,
}

#[tokio::main]
async fn main() {
    let db_pool = setup_database().await;

    let app = Router::new()
        .route("/api/notes", get(get_notes).post(post_note))
        .with_state(db_pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn setup_database() -> PgPool {
    let user = std::env::var("DB_USER").expect("DB_USER must be set");
    let password = std::env::var("DB_PASSWORD").expect("DB_PASSWORD must be set");
    let db_name = std::env::var("DB_NAME").expect("DB_NAME must be set");
    let db_url = format!("postgresql://{}:{}@postgres/{}", user, password, db_name);
    
    PgPool::connect(&db_url)
        .await
        .expect("Failed to create pool.")
}

async fn get_notes(State(pool): State<PgPool>) -> Result<Json<Vec<Note>>, StatusCode> {
    let notes = sqlx::query_as::<_, Note>("SELECT id, title, content FROM notes")
        .fetch_all(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(notes))
}

async fn post_note(State(pool): State<PgPool>, Json(payload): Json<CreateNote>) -> Result<Json<Note>, StatusCode> {
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