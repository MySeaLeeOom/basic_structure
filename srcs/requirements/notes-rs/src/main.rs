mod models;
mod handlers;

use axum::{
	routing::{get, post},
	Router,
};
use sqlx::PgPool;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
	let db_pool = setup_database().await;

	let app = Router::new()
		.route("/api/notes", get(handlers::get_all_notes).post(handlers::post_note))
		.route("/api/note/{id}", get(handlers::get_note))
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