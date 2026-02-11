use axum::{
    // `extract` module contains types that implement `FromRequest`. 
    // This is how Axum gets data OUT of the raw HTTP request and INTO your function arguments.
    // Query: Parses "query strings" (stuff after the ? in URL) into a Rust struct.
    // State: The magic that lets us access "Global Variables" (like DB connections or OAuth clients) 
    // inside our handlers without using unsafe global static mut variables. It's properly shared/cloned.
    extract::{Query, State},

    // `response` module contains types that implement `IntoResponse`.
    // Redirect: A helper struct that builds a proper HTTP 303 (See Other) response
    // to tell the browser "Go over there instead". Crucial for OAuth flows.
    response::Redirect,

    // `routing` contains the logic to map HTTP methods (GET, POST) to functions.
    routing::get,

    // The main building block of the application. It holds the route table.
    Router,
};

// The `oauth2` crate provides the heavy lifting for the OAuth2 protocol.
// It handles the complex "dance" of exchanging codes for tokens securely.
use oauth2::{
    // BasicClient: The standard implementation of an OAuth2 client. 
    // It knows how to form the URLs and parse the responses from GitHub.
    basic::BasicClient, 

    // Typed wrappers for strings. These Prevent "Primitive Obsession".
    // Instead of passing random strings around and hoping one is a URL and one is a Secret,
    // we wrap them in types so the compiler stops us if we mix them up.
    AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl, CsrfToken,
};

// Serde (SERialization/DEserialization) is the standard Rust framework for transforming data.
// Deserialize: A "derive macro". It writes code for us that can take JSON or Query Strings
// and automatically fill up the fields of a struct.
use serde::Deserialize;

use std::env; // To read environment variables from the OS (or .env file).
use std::net::SocketAddr; // Represents an IP:Port pair.

// tower_sessions handles the complexity of "Sessions".
// HTTP is stateless (it forgets you immediately). A "Session" allows us to remember a user
// across multiple requests by giving them a cookie ID.
use tower_sessions::{Expiry, MemoryStore, Session, SessionManagerLayer};

// #[tokio::main] is a macro that transforms the async main function.
// Rust does not have a built-in async runtime. Tokio provides the "engine" that runs tasks,
// handles network I/O, and manages timers. This macro sets up that engine before running your code.
#[tokio::main]
async fn main() {
    // Initialize tracing (logging).
    // In Rust, we don't just 'print'. We 'trace'. This allows structured logging (JSON logs),
    // varying log levels (DEBUG vs ERROR), and performance metrics.
    tracing_subscriber::fmt::init();

    // 1. Environment Configuration
    // We fetch these from the environment variables injected by Docker Compose.
    // We using .expect() here intentionally. This is "Panic-driven Development" for startup.
    // If these keys are missing, the server is useless. It is better to crash immediately (Fail Fast)
    // and show an error log than to start up in a broken state.
    let github_client_id = env::var("GITHUB_CLIENT_ID").expect("Missing GITHUB_CLIENT_ID");
    let github_client_secret = env::var("GITHUB_CLIENT_SECRET").expect("Missing GITHUB_CLIENT_SECRET");
    
    // 2. OAuth Client Configuration
    // AuthUrl: The URL where we send the USER to log in (GitHub's website).
    let auth_url = AuthUrl::new("https://github.com/login/oauth/authorize".to_string())
        .expect("Invalid authorization endpoint URL");
    
    // TokenUrl: The URL where WE (the server) talk to GitHub to exchange the code for a token.
    let token_url = TokenUrl::new("https://github.com/login/oauth/access_token".to_string())
        .expect("Invalid token endpoint URL");

    // RedirectUrl: Where GitHub sends the user back after they click "AGREE".
    // CRITICAL: This must match EXACTLY what is registered in the GitHub Developer Settings.
    // Any mismatch (even a trailing slash) causes a security error from GitHub.
    // We point this to our Nginx entry point (localhost:8080), which proxies to us.
    let redirect_url = RedirectUrl::new("http://localhost:8080/api/auth/callback".to_string())
        .expect("Invalid redirect URL");

    // Construct the OAuth client.
    // This struct holds all the configuration needed to perform the handshake.
    // We wrap the raw strings in their specific Types (ClientId, etc.) for safety.
    let client = BasicClient::new(
        ClientId::new(github_client_id),
        Some(ClientSecret::new(github_client_secret)),
        auth_url,
        Some(token_url),
    )
    .set_redirect_uri(redirect_url);

    // 3. Session Setup
    // MemoryStore: Stores session data in the RAM of this container.
    // WARNING: If this container restarts, all users are logged out.
    // For a production app, use RedisStore or SqliteStore. For this assignment, RAM is fine.
    let session_store = MemoryStore::default();
    
    // SessionManagerLayer: This is "Middleware". It sits between the incoming network request
    // and our handler functions.
    // 1. Request comes in -> Middleware checks Cookie header -> loads Session from RAM -> puts Session in request.
    // 2. Handler runs -> modifies Session.
    // 3. Response goes out -> Middleware saves Session to RAM -> writes Set-Cookie header.
    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false) // secure=true requires HTTPS. Since we are behind Nginx (HTTP locally), we set false.
        .with_expiry(Expiry::OnInactivity(tower_sessions::cookie::time::Duration::minutes(60))); // Auto-logout after 60m.

    // 4. Application Router
    // This defines the "Shape" of our web server.
    let app = Router::new()
        // Map specific paths to specific handler functions.
        .route("/api/auth/login", get(login_handler))
        .route("/api/auth/callback", get(callback_handler))
        // Health check for Docker/Kubernetes probes.
        .route("/health", get(health_check))
        // Layer: Wraps the router in the Session middleware defined above.
        // Every request hitting these routes now goes through the Session logic first.
        .layer(session_layer)
        // With_State: This injects the `client` variable into every handler that asks for it.
        // Doing this here means we don't need global variables. The state is cloned cheaply (Arc) per request.
        .with_state(client);

    // 5. Server Startup
    // 0.0.0.0 is crucial in Docker.
    // 127.0.0.1 means "loopback" (only accessible from INSIDE the container).
    // 0.0.0.0 means "all interfaces" (accessible from the Docker network/host).
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("listening on {}", addr);

    // Bind interrupts the OS networking stack to reserve port 3000.
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    // Start the infinite loop that accepts connections and spawns tasks to handle them.
    axum::serve(listener, app).await.unwrap();
}

// Simple health check handler.
// Returns a static string slice representing 200 OK.
async fn health_check() -> &'static str {
    "OK"
}

/// Initiates the OAuth flow.
/// 
/// Arguments:
/// - State(client): Axum automatically injects the `BasicClient` we configured in main.
/// 
/// Returns:
/// - Redirect: An HTTP response carrying a 303 status and a Location header.
async fn login_handler(State(client): State<BasicClient>) -> Redirect {
    // Generate the authorization URL.
    // CsrfToken::new_random generates a random string (the "State") to prevent CSRF attacks.
    // GitHub will send this string back to us in the callback. We should check it matches.
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .url();

    // TODO: In the next step, we must store `_csrf_token.secret()` in the Session/Cookie
    // so we can verify it when the user comes back. For now, we ignore it.
    
    // Redirect the user's browser to GitHub.
    Redirect::to(auth_url.as_str())
}

// This struct represents the data GitHub sends back to us in the URL query string.
// Example: http://localhost:8080/api/auth/callback?code=XYZ123&state=ABC987
#[derive(Deserialize)] // Code generation magic to parse query params into this struct.
struct AuthRequest {
    code: String, // The temporary authorization code we exchange for a token.
    state: String, // The CSRF token we sent earlier (must match).
}

/// Handles the callback from GitHub.
/// 
/// Arguments:
/// - Query(query): Axum parses `?code=...&state=...` into our `AuthRequest` struct.
/// - State(client): The OAuth client.
/// - session: The user's session (managed by tower-sessions).
async fn callback_handler(
    Query(query): Query<AuthRequest>,
    State(client): State<BasicClient>,
    session: Session,
) -> String {
    // Here we have the "Code". This proves the user logged in efficiently at GitHub.
    // But this code is useless to the user. We need to exchange it for an Access Token.
    // That token will allow us to ask GitHub "Who is this user?" (get their username/email).

    // Step 2 (Upcoming): Use `client` to exchange `query.code` for a token.
    format!("GitHub returned code: {}", query.code)
}


