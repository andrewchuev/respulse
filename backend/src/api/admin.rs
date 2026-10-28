//! Operator report: aggregate usage numbers to judge whether the service is worth developing.
//!
//! Only emails listed in `ADMIN_EMAILS` may read it. It deliberately returns aggregates and team
//! names, never user emails, and excludes the seeded demo organization.

use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::db::DbPool;
use crate::plans;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, NaiveDate, Utc};
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

/// Lets the UI decide whether to show the admin link without running the heavy report.
pub async fn admin_access(State(state): State<AppState>, auth: AuthUser) -> Json<Value> {
    Json(json!({ "is_admin": state.settings.is_admin(&auth.user.email) }))
}

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
        // Checking faster than a minute suggests the team values high-frequency probes.
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
