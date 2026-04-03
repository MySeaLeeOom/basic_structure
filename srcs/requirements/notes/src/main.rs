mod models;
mod handlers;

use axum::{
	routing::get,
	Router,
};
use sqlx::PgPool;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
	// Initialize tracing
	tracing_subscriber::registry()
		.with(tracing_subscriber::EnvFilter::try_from_default_env()
			.unwrap_or_else(|_| "notes=debug,tower_http=debug,axum::rejection=trace".into()))
		.with(tracing_subscriber::fmt::layer())
		.init();

	let db_pool = setup_database().await;

	let app = Router::new()
		.route("/api/notes", get(handlers::get_all_notes).post(handlers::post_note))
		.route("/api/notes/{id}", get(handlers::get_note).delete(handlers::del_note).put(handlers::edit_title))
		.route("/api/notes/shared/", get(handlers::get_all_shared_notes))
		.route("/api/notes/shared/{id}", get(handlers::get_shared_note).post(handlers::share_note).delete(handlers::remove_note_share))
		.with_state(db_pool);

	let port = std::env::var("PORT").unwrap_or_else(|_| "3003".to_string());
	let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().expect("Invalid address");
	
	tracing::info!("Listening on {}", addr);
	let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
	axum::serve(listener, app).await.unwrap();
}

async fn setup_database() -> PgPool {
	let user = std::env::var("DB_USER").expect("DB_USER must be set");
	let password = std::env::var("DB_PASSWORD").expect("DB_PASSWORD must be set");
	let db_name = std::env::var("DB_NAME").expect("DB_NAME must be set");
	let db_host = std::env::var("DB_HOST").unwrap_or_else(|_| "postgres".to_string());
	let db_url = format!("postgresql://{}:{}@{}/{}", user, password, db_host, db_name);
	
	tracing::info!("Connecting to database at {}:5432/{}", db_host, db_name);
	
	PgPool::connect(&db_url)
		.await
		.expect("Failed to create pool.")
}