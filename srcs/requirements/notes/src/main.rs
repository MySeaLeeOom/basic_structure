mod metrics;
mod models;
mod handlers;
mod i18n;

use axum::{
	body::Body,
	http::{header, StatusCode},
	response::Response,
	routing::get,
	Router,
};
use sqlx::PgPool;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub i18n: i18n::I18n,
}

#[tokio::main]
async fn main() {
	// Initialize tracing
	tracing_subscriber::registry()
		.with(tracing_subscriber::EnvFilter::try_from_default_env()
			.unwrap_or_else(|_| "notes=debug,tower_http=debug,axum::rejection=trace".into()))
		.with(tracing_subscriber::fmt::layer())
		.init();

	let db_pool = setup_database().await;
	let state = AppState {
		db_pool,
		i18n: i18n::I18n::new(),
	};
	metrics::init();

	async fn metrics_handler() -> Response {
		match metrics::gather_prometheus_text() {
			Ok((body, ctype)) => Response::builder()
				.status(StatusCode::OK)
				.header(header::CONTENT_TYPE, ctype)
				.body(Body::from(body))
				.unwrap_or_else(|_| Response::new(Body::empty())),
			Err(_) => Response::builder()
				.status(StatusCode::INTERNAL_SERVER_ERROR)
				.body(Body::empty())
				.unwrap_or_else(|_| Response::new(Body::empty())),
		}
	}

	let app = Router::new()
		.route("/metrics", get(metrics_handler))
		.route("/api/notes", get(handlers::get_all_notes).post(handlers::post_note))
		.route("/api/notes/{id}", get(handlers::get_note).delete(handlers::del_note).put(handlers::edit_title))
		.with_state(state);

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