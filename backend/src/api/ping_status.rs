//! Read-only status of the monitors of a team, by its Ping Key: what a tool that already pings
//! with the key (resmetrics, a cron wrapper) needs to show how the monitors are doing, without a
//! user account. The address, credentials and captured output of a monitor are not part of it.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::api::badge::monitor_state;
use crate::api::monitors::AppState;
use crate::models::Monitor;

fn describe(monitor: &Monitor, now: chrono::DateTime<Utc>) -> Value {
    json!({
        "slug": monitor.slug,
        "name": monitor.name,
        "type": monitor.monitor_type,
        "state": monitor_state(monitor, now),
        "response_ms": monitor.last_response_time_ms,
        "last_check_at": monitor.last_checked_at.map(|t| t.timestamp()),
        "interval_seconds": monitor.interval_seconds,
        "grace_seconds": monitor.grace_seconds,
        "group": monitor.group_name,
        "tags": monitor.tags,
    })
}

async fn team_of(state: &AppState, ping_key: &str) -> Result<Uuid, (StatusCode, String)> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM teams WHERE ping_key = $1")
        .bind(ping_key)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Invalid ping key".to_string()))
}

/// `GET /api/ping-status/:ping_key`: every monitor of the team.
pub async fn list_monitors(
    State(state): State<AppState>,
    Path(ping_key): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let team_id = team_of(&state, &ping_key).await?;
    let monitors: Vec<Monitor> =
        sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE team_id = $1 ORDER BY name ASC")
            .bind(team_id)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let now = Utc::now();
    let monitors: Vec<Value> = monitors.iter().map(|m| describe(m, now)).collect();
    Ok(Json(json!({ "monitors": monitors })))
}

/// `GET /api/ping-status/:ping_key/:slug`: one monitor.
pub async fn get_monitor(
    State(state): State<AppState>,
    Path((ping_key, slug)): Path<(String, String)>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let team_id = team_of(&state, &ping_key).await?;
    let clean_slug = slug.trim().to_lowercase().replace(' ', "-");
    let monitor = sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE team_id = $1 AND slug = $2")
        .bind(team_id)
        .bind(&clean_slug)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, format!("Monitor with slug '{clean_slug}' not found")))?;
    Ok(Json(describe(&monitor, Utc::now())))
}
