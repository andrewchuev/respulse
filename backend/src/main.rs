mod api;
mod db;
mod models;
mod probe;

use api::monitors::AppState;
use reqwest::Client;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "respulse_api=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting ResPulse Backend...");

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://respulse:respulse@localhost:5435/respulse".to_string());

    let pool = db::init_db(&database_url).await?;

    let (tx, _rx) = broadcast::channel(200);

    let http_client = Arc::new(
        Client::builder()
            .user_agent("ResPulse/1.0 (+https://respulse.wsl.local)")
            .danger_accept_invalid_certs(true)
            .build()
            .expect("Failed to build HTTP client"),
    );

    let state = AppState {
        pool: pool.clone(),
        tx: tx.clone(),
        http_client,
    };

    // Spawn probe background scheduler
    tokio::spawn(probe::run_probe_scheduler(pool.clone(), tx.clone()));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_router = api::create_router();

    let app = axum::Router::new()
        .nest("/api", api_router)
        .route("/ws", axum::routing::get(api::ws::ws_handler))
        .route("/health", axum::routing::get(|| async { "ResPulse Backend OK" }))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("ResPulse API Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
