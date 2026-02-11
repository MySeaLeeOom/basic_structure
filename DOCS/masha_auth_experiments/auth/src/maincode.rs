use axum::{
    extract::{Query, State},
    response::Redirect,
    routing::get,
    Router,
};
use oauth2::{
    basic::BasicClient, AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl, CsrfToken,
};
use serde::Deserialize;
use std::env;
use std::net::SocketAddr;
use tower_sessions::{Expiry, MemoryStore, Session, SessionManagerLayer};

// #[tokio::main]
// async fn main() {
//     tracing_subscriber::fmt::init();

//     // 1. Environment Configuration
//     let github_client_id = env::var("GITHUB_CLIENT_ID").expect("Missing GITHUB_CLIENT_ID");
//     let github_client_secret = env::var("GITHUB_CLIENT_SECRET").expect("Missing GITHUB_CLIENT_SECRET");
//     // session_secret logic omitted for MVP brevity, using default key generation in real app usage
    
//     // 2. OAuth Client Configuration
//     let auth_url = AuthUrl::new("https://github.com/login/oauth/authorize".to_string())
//         .expect("Invalid authorization endpoint URL");
//     let token_url = TokenUrl::new("https://github.com/login/oauth/access_token".to_string())
//         .expect("Invalid token endpoint URL");

//     // NOTE: redirect_url must match exactly what is in GitHub App settings
//     let redirect_url = RedirectUrl::new("http://localhost:8080/api/auth/callback".to_string())
//         .expect("Invalid redirect URL");

//     let client = BasicClient::new(
//         ClientId::new(github_client_id),
//         Some(ClientSecret::new(github_client_secret)),
//         auth_url,
//         Some(token_url),
//     )
//     .set_redirect_uri(redirect_url);

//     // 3. Session Setup
//     let session_store = MemoryStore::default();
//     let session_layer = SessionManagerLayer::new(session_store)
//         .with_secure(false) // Set to true if using HTTPS in production
//         .with_expiry(Expiry::OnInactivity(tower_sessions::cookie::time::Duration::minutes(60)));

//     let app = Router::new()
//         .route("/api/auth/login", get(login_handler))
//         .route("/api/auth/callback", get(callback_handler))
//         .route("/health", get(health_check))
//         .layer(session_layer)
//         .with_state(client);

//     let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
//     tracing::info!("listening on {}", addr);

//     let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
//     axum::serve(listener, app).await.unwrap();
// }

async fn health_check() -> &'static str {
    "OK"
}

/// Initiates the OAuth flow
async fn login_handler(State(client): State<BasicClient>) -> Redirect {
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .url();

    // In a real app, store _csrf_token in session to validate state on callback
    Redirect::to(auth_url.as_str())
}

#[derive(Deserialize)]
struct AuthRequest {
    code: String,
    state: String,
}

/// Handles the callback from GitHub
async fn callback_handler(
    Query(query): Query<AuthRequest>,
    State(client): State<BasicClient>,
    session: Session,
) -> String {
    // This is where we will Step 2: Exchange code for token and create session
    format!("GitHub returned code: {}", query.code)
}


