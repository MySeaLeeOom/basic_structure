mod models;
mod handlers;
mod share_handlers;
mod slug_handlers;

use axum::{
	routing::{get, post, delete},
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
		.route("/api/notes/u/{slug}", get(slug_handlers::get_note_by_slug))
		.route("/api/notes/collab/received", get(share_handlers::shared_with_me))      // notes others shared with me
		.route("/api/notes/collab/", post(share_handlers::create_share))               // create a share (note_id in body)
		.route("/api/notes/collab/access/{share_id}", get(share_handlers::open_share)) // open a note via share link
		.route("/api/notes/collab/created", get(share_handlers::my_shares))            // all shares I created
		.route("/api/notes/collab/{note_id}", get(share_handlers::note_collaborators)) // list collaborators on a specific note
		.route("/api/notes/collab/revoke/{share_id}", delete(share_handlers::revoke_share)) // revoke a share
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