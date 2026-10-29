//! Operator & Super-Administrator Control Plane:
//! Platform telemetry, tenant management, user lifecycle, and system diagnostics.
//!
//! Only emails listed in `ADMIN_EMAILS` (or default demo admin) may access these endpoints.

use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::db::DbPool;
use crate::models::Monitor;
use crate::plans;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::error;
use uuid::Uuid;

const DEMO_TEAM_ID: Uuid = Uuid::from_u128(1);

fn require_admin(auth: &AuthUser, state: &AppState) -> Result<(), (StatusCode, Response)> {
    if state.settings.is_admin(&auth.user.email) {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Forbidden: operator access only" })).into_response(),
        ))
    }
}

/// Lets the UI decide whether to show the admin link without running heavy reports.
pub async fn admin_access(State(state): State<AppState>, auth: AuthUser) -> Json<Value> {
    Json(json!({ "is_admin": state.settings.is_admin(&auth.user.email) }))
}

// -----------------------------------------------------------------------------
// 1. Teams / Tenants Management
// -----------------------------------------------------------------------------

#[derive(Serialize)]
pub struct AdminTeamItem {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub plan: String,
    pub subscription_status: String,
    pub ping_key: String,
    pub created_at: DateTime<Utc>,
    pub monitors_count: i64,
    pub users_count: i64,
    pub active_incidents_count: i64,
}

pub async fn list_teams(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<AdminTeamItem>>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;

    let rows: Vec<(Uuid, String, String, String, String, String, DateTime<Utc>, i64, i64, i64)> =
        sqlx::query_as(
            r#"
            SELECT 
                t.id, 
                t.name, 
                t.slug, 
                t.plan, 
                t.subscription_status,
                t.ping_key, 
                t.created_at,
                COALESCE(COUNT(DISTINCT m.id), 0)::bigint as monitors_count,
                COALESCE(COUNT(DISTINCT u.id), 0)::bigint as users_count,
                COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'ONGOING'), 0)::bigint as active_incidents_count
            FROM teams t
            LEFT JOIN monitors m ON m.team_id = t.id
            LEFT JOIN users u ON u.team_id = t.id
            LEFT JOIN incidents i ON i.team_id = t.id
            GROUP BY t.id, t.name, t.slug, t.plan, t.subscription_status, t.ping_key, t.created_at
            ORDER BY t.created_at DESC
            "#,
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to query admin teams: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to query teams" })).into_response(),
            )
        })?;

    let items = rows
        .into_iter()
        .map(
            |(id, name, slug, plan, subscription_status, ping_key, created_at, monitors_count, users_count, active_incidents_count)| {
                AdminTeamItem {
                    id,
                    name,
                    slug,
                    plan,
                    subscription_status,
                    ping_key,
                    created_at,
                    monitors_count,
                    users_count,
                    active_incidents_count,
                }
            },
        )
        .collect();

    Ok(Json(items))
}

#[derive(Deserialize)]
pub struct UpdateTeamPlanPayload {
    pub plan: String,
}

pub async fn update_team_plan(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(team_id): Path<Uuid>,
    Json(payload): Json<UpdateTeamPlanPayload>,
) -> Result<Json<Value>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;
    let plan = payload.plan.trim().to_uppercase();
    if plan != "FREE" && plan != "PRO" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Plan must be 'FREE' or 'PRO'" })).into_response(),
        ));
    }

    sqlx::query("UPDATE teams SET plan = $1 WHERE id = $2")
        .bind(&plan)
        .bind(team_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to update team plan: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to update team plan" })).into_response(),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "team_id": team_id, "plan": plan })))
}

pub async fn delete_team(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(team_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;
    if team_id == DEMO_TEAM_ID {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Cannot delete primary demo system organization" })).into_response(),
        ));
    }

    sqlx::query("DELETE FROM teams WHERE id = $1")
        .bind(team_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to delete team: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to delete team" })).into_response(),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "deleted_team_id": team_id })))
}

// -----------------------------------------------------------------------------
// 2. Users Management
// -----------------------------------------------------------------------------

#[derive(Serialize)]
pub struct AdminUserItem {
    pub id: Uuid,
    pub team_id: Uuid,
    pub team_name: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub email_verified_at: Option<DateTime<Utc>>,
}

pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<AdminUserItem>>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;

    let rows: Vec<(Uuid, Uuid, String, String, String, String, bool, DateTime<Utc>, Option<DateTime<Utc>>, Option<DateTime<Utc>>)> =
        sqlx::query_as(
            r#"
            SELECT 
                u.id, 
                u.team_id, 
                t.name as team_name, 
                u.email, 
                u.name, 
                u.role, 
                u.is_active, 
                u.created_at, 
                u.last_login_at, 
                u.email_verified_at
            FROM users u
            JOIN teams t ON t.id = u.team_id
            ORDER BY u.created_at DESC
            "#,
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to query admin users: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to query users" })).into_response(),
            )
        })?;

    let items = rows
        .into_iter()
        .map(
            |(id, team_id, team_name, email, name, role, is_active, created_at, last_login_at, email_verified_at)| {
                AdminUserItem {
                    id,
                    team_id,
                    team_name,
                    email,
                    name,
                    role,
                    is_active,
                    created_at,
                    last_login_at,
                    email_verified_at,
                }
            },
        )
        .collect();

    Ok(Json(items))
}

#[derive(Deserialize)]
pub struct UpdateUserStatusPayload {
    pub is_active: bool,
}

pub async fn update_user_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<UpdateUserStatusPayload>,
) -> Result<Json<Value>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;

    // Protect self from accidental lockout
    if user_id == auth.user.id && !payload.is_active {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot deactivate your own active super-administrator account" })).into_response(),
        ));
    }

    sqlx::query("UPDATE users SET is_active = $1 WHERE id = $2")
        .bind(payload.is_active)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to update user active status: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to update user status" })).into_response(),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "user_id": user_id, "is_active": payload.is_active })))
}

// -----------------------------------------------------------------------------
// 3. System Health & Infrastructure Diagnostics
// -----------------------------------------------------------------------------

#[derive(Serialize)]
pub struct AdminSystemStatus {
    pub database_connected: bool,
    pub total_check_results: i64,
    pub check_results_bytes: i64,
    pub database_bytes: i64,
    pub total_incidents: i64,
    pub active_incidents: i64,
    pub total_monitors: i64,
    pub active_monitors: i64,
    pub total_teams: i64,
    pub total_users: i64,
    pub allow_private_targets: bool,
    pub billing_enabled: bool,
    pub demo_mode: bool,
    pub email_verification_required: bool,
    pub smtp_configured: bool,
}

pub async fn get_system_status(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<AdminSystemStatus>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;

    let row: (i64, i64, i64, i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            (SELECT COUNT(*) FROM check_results)::bigint,
            (SELECT pg_total_relation_size('check_results'))::bigint,
            (SELECT pg_database_size(current_database()))::bigint,
            (SELECT COUNT(*) FROM incidents)::bigint,
            (SELECT COUNT(*) FROM incidents WHERE status = 'ONGOING')::bigint,
            (SELECT COUNT(*) FROM monitors)::bigint,
            (SELECT COUNT(*) FROM monitors WHERE NOT is_paused)::bigint,
            (SELECT COUNT(*) FROM teams)::bigint,
            (SELECT COUNT(*) FROM users)::bigint
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to read system status: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to query system status" })).into_response(),
        )
    })?;

    Ok(Json(AdminSystemStatus {
        database_connected: true,
        total_check_results: row.0,
        check_results_bytes: row.1,
        database_bytes: row.2,
        total_incidents: row.3,
        active_incidents: row.4,
        total_monitors: row.5,
        active_monitors: row.6,
        total_teams: row.7,
        total_users: row.8,
        allow_private_targets: std::env::var("ALLOW_PRIVATE_TARGETS")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(false),
        billing_enabled: state.settings.billing_enabled,
        demo_mode: state.auth.demo_mode,
        email_verification_required: state.settings.require_email_verification,
        smtp_configured: state.mailer.is_some(),
    }))
}

pub async fn trigger_prune(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;

    let deleted = crate::retention::prune_now(&state.pool).await.map_err(|e| {
        error!("Manual retention pruning failed: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Pruning failed: {}", e) })).into_response(),
        )
    })?;

    Ok(Json(json!({
        "status": "ok",
        "message": format!("Successfully pruned {} expired check results", deleted),
        "deleted_rows": deleted
    })))
}

pub async fn trigger_backup_ping(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;

    let monitor_opt: Option<Monitor> = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE heartbeat_token = '37e2216caedb454ea5286aa1ee8d1044' OR name = 'Database Automated Backup' LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })).into_response(),
        )
    })?;

    let monitor = monitor_opt.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Database Automated Backup monitor not found" })).into_response(),
        )
    })?;

    let (_, val) = super::heartbeat::execute_heartbeat_lifecycle(
        state,
        monitor,
        None,
        axum::body::Bytes::new(),
    )
    .await
    .map_err(|(code, msg)| {
        (
            code,
            Json(json!({ "error": msg })).into_response(),
        )
    })?;

    Ok(Json(json!({
        "status": "ok",
        "message": "Backup heartbeat signal dispatched successfully",
        "result": val
    })))
}

// -----------------------------------------------------------------------------
// 4. Analytics & Operator Report
// -----------------------------------------------------------------------------

pub async fn get_report(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Response)> {
    require_admin(&auth, &state)?;

    build_report(&state.pool).await.map(Json).map_err(|e| {
        error!("Failed to build admin report: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to build report" })).into_response(),
        )
    })
}

async fn count(pool: &DbPool, sql: &str) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar::<_, i64>(sql).bind(DEMO_TEAM_ID).fetch_one(pool).await
}

async fn build_report(pool: &DbPool) -> Result<Value, sqlx::Error> {
    let teams = count(pool, "SELECT COUNT(*)::bigint FROM teams WHERE id <> $1").await?;
    let users = count(pool, "SELECT COUNT(*)::bigint FROM users WHERE team_id <> $1").await?;
    let activated = count(pool, "SELECT COUNT(DISTINCT team_id)::bigint FROM monitors WHERE team_id <> $1").await?;
    let with_channels =
        count(pool, "SELECT COUNT(DISTINCT team_id)::bigint FROM notification_channels WHERE team_id <> $1").await?;
    let with_heartbeat = count(
        pool,
        "SELECT COUNT(DISTINCT team_id)::bigint FROM monitors WHERE team_id <> $1 AND monitor_type = 'HEARTBEAT'",
    )
    .await?;
    let active_7d = count(
        pool,
        "SELECT COUNT(DISTINCT team_id)::bigint FROM users WHERE team_id <> $1 AND last_login_at >= NOW() - INTERVAL '7 days'",
    )
    .await?;
    let active_30d = count(
        pool,
        "SELECT COUNT(DISTINCT team_id)::bigint FROM users WHERE team_id <> $1 AND last_login_at >= NOW() - INTERVAL '30 days'",
    )
    .await?;
    let pro_teams = count(pool, "SELECT COUNT(*)::bigint FROM teams WHERE id <> $1 AND plan = 'PRO'").await?;

    let signups: Vec<(NaiveDate, i64)> = sqlx::query_as(
        r#"
        SELECT d::date, COALESCE(c.n, 0)::bigint
        FROM generate_series((CURRENT_DATE - 29)::timestamp, CURRENT_DATE::timestamp, INTERVAL '1 day') d
        LEFT JOIN (
            SELECT created_at::date AS day, COUNT(*) AS n FROM teams WHERE id <> $1 GROUP BY 1
        ) c ON c.day = d::date
        ORDER BY 1
        "#,
    )
    .bind(DEMO_TEAM_ID)
    .fetch_all(pool)
    .await?;

    let cohorts: Vec<(NaiveDate, i64, i64, i64)> = sqlx::query_as(
        r#"
        SELECT date_trunc('week', t.created_at)::date,
               COUNT(*)::bigint,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM monitors m WHERE m.team_id = t.id))::bigint,
               COUNT(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM users u WHERE u.team_id = t.id AND u.last_login_at >= NOW() - INTERVAL '14 days'
               ))::bigint
        FROM teams t
        WHERE t.id <> $1 AND t.created_at >= date_trunc('week', NOW()) - INTERVAL '7 weeks'
        GROUP BY 1 ORDER BY 1
        "#,
    )
    .bind(DEMO_TEAM_ID)
    .fetch_all(pool)
    .await?;

    // Limit pressure: how many teams push against their plan, a proxy for wanting more.
    let per_team: Vec<(String, i64, i64)> = sqlx::query_as(
        r#"
        SELECT t.plan,
               COUNT(m.id)::bigint,
               COALESCE(MIN(m.interval_seconds) FILTER (WHERE m.monitor_type <> 'HEARTBEAT'), 0)::bigint
        FROM teams t LEFT JOIN monitors m ON m.team_id = t.id
        WHERE t.id <> $1
        GROUP BY t.id, t.plan
        "#,
    )
    .bind(DEMO_TEAM_ID)
    .fetch_all(pool)
    .await?;
    let mut near_limit = 0;
    let mut at_limit = 0;
    let mut fast_interval = 0;
    let mut total_monitors = 0;
    let mut teams_with_monitors = 0;
    for (plan, monitors, min_interval) in &per_team {
        let limit = plans::limits(plan);
        if *monitors > 0 {
            teams_with_monitors += 1;
            total_monitors += monitors;
        }
        if *monitors >= limit.max_monitors {
            at_limit += 1;
        } else if *monitors * 5 >= limit.max_monitors * 4 {
            near_limit += 1;
        }
        if *min_interval > 0 && *min_interval < 60 {
            fast_interval += 1;
        }
    }

    let by_type: Vec<(String, i64)> = sqlx::query_as(
        "SELECT monitor_type, COUNT(*)::bigint FROM monitors WHERE team_id <> $1 GROUP BY 1 ORDER BY 2 DESC",
    )
    .bind(DEMO_TEAM_ID)
    .fetch_all(pool)
    .await?;

    let checks_24h: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM check_results WHERE checked_at >= NOW() - INTERVAL '24 hours'")
            .fetch_one(pool)
            .await?;
    let (probe_monitors, probes_per_second): (i64, f64) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint, COALESCE(SUM(1.0 / interval_seconds), 0)::float8
        FROM monitors WHERE NOT is_paused AND monitor_type <> 'HEARTBEAT' AND interval_seconds > 0
        "#,
    )
    .fetch_one(pool)
    .await?;
    let db_bytes: i64 = sqlx::query_scalar("SELECT pg_database_size(current_database())::bigint")
        .fetch_one(pool)
        .await?;
    let history_bytes: i64 = sqlx::query_scalar("SELECT pg_total_relation_size('check_results')::bigint")
        .fetch_one(pool)
        .await?;

    let (incidents_total, incidents_open): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*)::bigint, COUNT(*) FILTER (WHERE status <> 'RESOLVED')::bigint FROM incidents WHERE team_id <> $1",
    )
    .bind(DEMO_TEAM_ID)
    .fetch_one(pool)
    .await?;
    let alerts: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT a.status, COUNT(*)::bigint
        FROM alert_logs a JOIN notification_channels c ON c.id = a.channel_id
        WHERE c.team_id <> $1 AND a.sent_at >= NOW() - INTERVAL '7 days' AND a.event_type <> 'TEST'
        GROUP BY 1
        "#,
    )
    .bind(DEMO_TEAM_ID)
    .fetch_all(pool)
    .await?;
    let alert_count = |status: &str| alerts.iter().find(|(s, _)| s == status).map_or(0, |(_, n)| *n);

    let recent: Vec<(String, DateTime<Utc>, String, i64, i64, Option<DateTime<Utc>>)> = sqlx::query_as(
        r#"
        SELECT t.name, t.created_at, t.plan,
               (SELECT COUNT(*) FROM monitors m WHERE m.team_id = t.id)::bigint,
               (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id)::bigint,
               (SELECT MAX(u.last_login_at) FROM users u WHERE u.team_id = t.id)
        FROM teams t WHERE t.id <> $1 ORDER BY t.created_at DESC LIMIT 15
        "#,
    )
    .bind(DEMO_TEAM_ID)
    .fetch_all(pool)
    .await?;

    Ok(json!({
        "generated_at": Utc::now(),
        "totals": {
            "teams": teams,
            "users": users,
            "activated_teams": activated,
            "teams_with_alert_channel": with_channels,
            "teams_with_heartbeat": with_heartbeat,
            "active_teams_7d": active_7d,
            "active_teams_30d": active_30d,
            "pro_teams": pro_teams,
            "monitors": total_monitors,
            "avg_monitors_per_active_team": if teams_with_monitors > 0 {
                total_monitors as f64 / teams_with_monitors as f64
            } else { 0.0 },
        },
        "limit_pressure": {
            "near_limit": near_limit,
            "at_limit": at_limit,
            "fast_interval_teams": fast_interval,
        },
        "signups_daily": signups.iter().map(|(d, n)| json!({ "date": d, "teams": n })).collect::<Vec<_>>(),
        "cohorts": cohorts.iter().map(|(w, t, a, ac)| json!({
            "week": w, "teams": t, "activated": a, "active_14d": ac,
        })).collect::<Vec<_>>(),
        "monitors_by_type": by_type.iter().map(|(t, n)| json!({ "type": t, "count": n })).collect::<Vec<_>>(),
        "load": {
            "checks_24h": checks_24h,
            "probe_monitors": probe_monitors,
            "probes_per_second": probes_per_second,
            "database_bytes": db_bytes,
            "history_table_bytes": history_bytes,
        },
        "incidents": { "total": incidents_total, "open": incidents_open },
        "alerts_7d": { "success": alert_count("SUCCESS"), "failed": alert_count("FAILED") },
        "recent_teams": recent.iter().map(|(name, created, plan, monitors, members, last_login)| json!({
            "name": name, "created_at": created, "plan": plan,
            "monitors": monitors, "members": members, "last_login_at": last_login,
        })).collect::<Vec<_>>(),
    }))
}
