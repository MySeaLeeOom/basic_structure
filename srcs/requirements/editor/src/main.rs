mod state;
mod ws_handler;

use axum::{
	routing::get,
	Router,
};
use sqlx::PgPool;
use std::net::SocketAddr;
use std::sync::Arc;
use state::AppState;

#[tokio::main]
async fn main() {
	let db_pool = setup_database().await;
	let app_state = Arc::new(AppState::new(db_pool));

	let app = Router::new()
		.route("/ws/{id}", get(ws_handler::ws_route))
		.with_state(app_state);

	let addr = SocketAddr::from(([0, 0, 0, 0], 3004));
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