pub mod heartbeat;
pub mod incidents;
pub mod monitors;
pub mod notifications;
pub mod stats;
pub mod ws;

use axum::routing::get;
use axum::Router;
use monitors::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/monitors", get(monitors::list_monitors).post(monitors::create_monitor))
        .route("/monitors/:id", get(monitors::get_monitor).put(monitors::update_monitor).delete(monitors::delete_monitor))
        .route("/monitors/:id/pause", axum::routing::post(monitors::pause_monitor))
        .route("/monitors/:id/resume", axum::routing::post(monitors::resume_monitor))
        .route("/monitors/:id/test", axum::routing::post(monitors::trigger_test))
        .route("/notifications", get(notifications::list_channels).post(notifications::create_channel))
        .route("/notifications/:id", axum::routing::put(notifications::update_channel).delete(notifications::delete_channel))
        .route("/notifications/:id/test", axum::routing::post(notifications::test_channel))
        .route("/notifications/logs", get(notifications::list_alert_logs))
        .route("/incidents", get(incidents::list_incidents))
        .route("/stats", get(stats::get_stats))
        .route("/status-page", get(stats::get_status_page))
        .route("/heartbeat/:token", axum::routing::post(heartbeat::ping_heartbeat).get(heartbeat::ping_heartbeat))
}
