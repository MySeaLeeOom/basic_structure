mod models;
mod handlers;
mod sync;

use axum::{
    routing::{get, post},
    Router,
};
use sync::AppState;
use std::net::SocketAddr;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let db_pool = setup_database().await;
    let state = Arc::new(AppState::new(db_pool));

    let app = Router::new()
        .route("/api/notes", get(handlers::get_all_notes).post(handlers::create_note))
        .route("/api/notes/{id}", get(handlers::get_note).delete(handlers::delete_note))
        .route("/api/notes/{id}/sync", get(handlers::ws_sync))
        .route("/api/notes/{id}/update", post(handlers::apply_update))
        .route("/api/notes/{id}/updates", get(handlers::get_updates_since))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3003));
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn setup_database() -> sqlx::PgPool {
    let user = std::env::var("DB_USER").expect("DB_USER must be set");
    let password = std::env::var("DB_PASSWORD").expect("DB_PASSWORD must be set");
    let db_name = std::env::var("DB_NAME").expect("DB_NAME must be set");
    let db_url = format!("postgresql://{}:{}@postgres/{}", user, password, db_name);
    sqlx::PgPool::connect(&db_url)
        .await
        .expect("Failed to create pool.")
}
