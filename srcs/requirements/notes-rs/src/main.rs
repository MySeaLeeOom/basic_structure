mod handlers;
mod models;
mod sync;

use axum::{
    Router,
    routing::{get, post},
};
use std::net::SocketAddr;
use std::sync::Arc;
use sync::AppState;

#[tokio::main]
async fn main() {
    let db_pool = setup_database().await;
    let state = Arc::new(AppState::new(db_pool));

    let app = Router::new()
        // REST endpoints are for snapshot/bootstrap and note lifecycle operations.
        .route(
            "/api/notes",
            get(handlers::get_all_notes).post(handlers::create_note),
        )
        .route(
            "/api/notes/{id}",
            get(handlers::get_note).delete(handlers::delete_note),
        )
        // WebSocket is the primary sync transport for collaborative editing.
        .route("/api/notes/{id}/sync", get(handlers::ws_sync))
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
