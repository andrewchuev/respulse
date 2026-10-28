mod api;
mod auth;
mod db;
mod models;
mod net_guard;
mod notifier;
mod plans;
mod probe;
mod rate_limit;
mod retention;

use api::monitors::AppState;
use api::payments::WebhookConfig;
use auth::AuthConfig;
use plans::AppSettings;
use rate_limit::RateLimits;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::broadcast;
use axum::http::{header, HeaderValue, Method};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    rustls::crypto::ring::default_provider().install_default().ok();

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

    let user_agent = std::env::var("APP_USER_AGENT")
        .unwrap_or_else(|_| "ResPulse/1.0 (+https://respulse.online)".to_string());

    let target_policy = net_guard::init_from_env();
    if target_policy.allow_private() {
        warn!("ALLOW_PRIVATE_TARGETS is enabled: probes and webhooks may reach private networks");
    }
    let http_client = Arc::new(target_policy.build_client(user_agent));

    let limits = Arc::new(RateLimits::new());
    limits.spawn_cleanup();

    let auth = Arc::new(AuthConfig::from_env()?);
    if auth.demo_mode {
        warn!("DEMO_MODE is enabled: passwordless persona login and demo passwords are active");
    }

    let state = AppState {
        pool: pool.clone(),
        tx: tx.clone(),
        http_client,
        auth,
        webhook: Arc::new(WebhookConfig::from_env()),
        limits,
        settings: Arc::new(AppSettings::from_env()),
    };

    // Spawn probe background scheduler
    tokio::spawn(probe::run_probe_scheduler(pool.clone(), tx.clone()));
    tokio::spawn(retention::run_retention_loop(pool.clone()));

    let api_router = api::create_router();

    let app = axum::Router::new()
        .nest("/api", api_router)
        .route("/ws", axum::routing::get(api::ws::ws_handler))
        .route("/health", axum::routing::get(|| async { "ResPulse Backend OK" }))
        .route("/metrics", axum::routing::get(api::metrics::get_prometheus_metrics))
        .route("/badge/:token", axum::routing::get(api::badge::get_badge_by_token))
        .route("/badge/:ping_key/:slug", axum::routing::get(api::badge::get_badge_by_slug));

    // The SPA is served from the same origin, so CORS stays off unless origins are listed explicitly.
    let app = match cors_layer_from_env() {
        Some(cors) => app.layer(cors),
        None => app,
    };
    let app = app.layer(TraceLayer::new_for_http()).with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("ResPulse API Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    // Connect info gives the auth rate limiter the TCP peer address.
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;

    Ok(())
}

/// Builds a CORS layer from `CORS_ALLOWED_ORIGINS` (comma-separated origins); `None` when unset.
fn cors_layer_from_env() -> Option<CorsLayer> {
    let raw = std::env::var("CORS_ALLOWED_ORIGINS").ok()?;
    let origins: Vec<HeaderValue> = raw
        .split(',')
        .map(str::trim)
        .filter(|o| !o.is_empty())
        .filter_map(|o| match HeaderValue::from_str(o) {
            Ok(v) => Some(v),
            Err(_) => {
                warn!("Ignoring invalid CORS origin: {}", o);
                None
            }
        })
        .collect();
    if origins.is_empty() {
        return None;
    }

    info!("CORS enabled for {} origin(s)", origins.len());
    Some(
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
            .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]),
    )
}
