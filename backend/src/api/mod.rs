pub mod admin;
pub mod auth;
pub mod badge;
pub mod export_import;
pub mod fastspring;
pub mod heartbeat;
pub mod incidents;
pub mod metrics;
pub mod monitors;
pub mod notifications;
pub mod payments;
pub mod stats;
pub mod team;
pub mod wayforpay;
pub mod ws;

use axum::routing::get;
use axum::Router;
use monitors::AppState;

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/health", get(|| async { "OK" }))
        // Auth & Identity
        .route("/auth/register", axum::routing::post(auth::register))
        .route("/auth/login", axum::routing::post(auth::login))
        .route("/auth/verify-email", axum::routing::post(auth::verify_email))
        .route("/auth/resend-verification", axum::routing::post(auth::resend_verification))
        .route("/auth/config", get(auth::auth_config))
        .route("/auth/me", get(auth::get_current_user))
        .route("/auth/users", get(auth::list_available_users))
        .route("/auth/switch-user", axum::routing::post(auth::switch_user))
        // Team Management & RBAC
        .route("/team/members", get(team::list_team_members).post(team::invite_member))
        .route("/team/members/:id/role", axum::routing::put(team::update_member_role))
        .route("/team/members/:id", axum::routing::delete(team::remove_member))
        .route("/team/plan", axum::routing::put(team::update_team_plan).post(team::update_team_plan))
        // WayForPay Billing & Subscriptions
        .route("/billing/status", get(wayforpay::get_billing_status))
        .route("/billing/wayforpay/checkout", axum::routing::post(wayforpay::create_checkout_session))
        .route("/billing/wayforpay/webhook", axum::routing::post(wayforpay::billing_webhook))
        .route("/billing/wayforpay/cancel", axum::routing::post(wayforpay::cancel_subscription))
        // Payments & FastSpring Subscription
        .route("/payments/fastspring/config", get(payments::get_fastspring_config))
        .route("/payments/fastspring/confirm", axum::routing::post(payments::confirm_fastspring_payment))
        .route("/payments/fastspring/webhook", axum::routing::post(payments::fastspring_webhook))
        .route("/payments/history", get(payments::get_payment_history))
        // Operator report & super-admin control plane
        .route("/admin/access", get(admin::admin_access))
        .route("/admin/report", get(admin::get_report))
        .route("/admin/teams", get(admin::list_teams))
        .route("/admin/teams/:id/plan", axum::routing::patch(admin::update_team_plan))
        .route("/admin/teams/:id", axum::routing::delete(admin::delete_team))
        .route("/admin/users", get(admin::list_users))
        .route("/admin/users/:id/status", axum::routing::patch(admin::update_user_status))
        .route("/admin/system/status", get(admin::get_system_status))
        .route("/admin/system/prune", axum::routing::post(admin::trigger_prune))
        .route("/admin/system/backup-ping", axum::routing::post(admin::trigger_backup_ping))
        // Monitors
        .route("/monitors", get(monitors::list_monitors).post(monitors::create_monitor))
        .route("/monitors/bulk", axum::routing::post(monitors::bulk_action))
        .route("/monitors/:id", get(monitors::get_monitor).put(monitors::update_monitor).delete(monitors::delete_monitor))
        .route("/monitors/:id/pause", axum::routing::post(monitors::pause_monitor))
        .route("/monitors/:id/resume", axum::routing::post(monitors::resume_monitor))
        .route("/monitors/:id/test", axum::routing::post(monitors::trigger_test))
        // Notifications
        .route("/notifications", get(notifications::list_channels).post(notifications::create_channel))
        .route("/notifications/:id", axum::routing::put(notifications::update_channel).delete(notifications::delete_channel))
        .route("/notifications/:id/test", axum::routing::post(notifications::test_channel))
        .route("/notifications/logs", get(notifications::list_alert_logs))
        // Configuration Export & Import
        .route("/config/export", get(export_import::export_config))
        .route("/config/import", axum::routing::post(export_import::import_config))
        // Incidents
        .route("/incidents", get(incidents::list_incidents).post(incidents::create_manual_incident))
        .route("/incidents/:id", get(incidents::get_incident).put(incidents::update_incident))
        .route("/incidents/:id/updates", axum::routing::post(incidents::add_incident_update))
        // Metrics & Status Page
        .route("/stats", get(stats::get_stats))
        .route("/status-page", get(stats::get_status_page))
        .route("/metrics", get(metrics::get_prometheus_metrics))
        // Badges (Shields.io / Healthchecks style SVG badges)
        .route("/badge/:token", get(badge::get_badge_by_token))
        .route("/badge/:ping_key/:slug", get(badge::get_badge_by_slug))
        .route("/heartbeat/:token", axum::routing::post(heartbeat::ping_heartbeat).get(heartbeat::ping_heartbeat))
        .route("/heartbeat/:token/:action", axum::routing::post(heartbeat::ping_heartbeat_action).get(heartbeat::ping_heartbeat_action))
        // Slug-based pinging & auto-provisioning (?create=1)
        .route("/ping/:ping_key/:slug", axum::routing::post(heartbeat::ping_by_slug).get(heartbeat::ping_by_slug))
        .route("/ping/:ping_key/:slug/:action", axum::routing::post(heartbeat::ping_by_slug_action).get(heartbeat::ping_by_slug_action))
}
