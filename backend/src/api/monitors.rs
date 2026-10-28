use crate::api::payments::WebhookConfig;
use crate::auth::{AuthConfig, AuthUser};
use crate::db::DbPool;
use crate::models::{
    CheckResult, CreateMonitorRequest, LatencyPoint, Monitor, MonitorWithStats,
    UptimeBarPoint, UpdateMonitorRequest, WsMessage,
};
use crate::net_guard;
use crate::plans::{self, AppSettings};
use crate::probe::runner::execute_single_probe;
use crate::rate_limit::RateLimits;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{Duration, Utc};
use reqwest::Client;
use sqlx::FromRow;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::broadcast::Sender;
use uuid::Uuid;

/// Rejects targets that would let a monitor probe internal networks.
async fn validate_monitor_target(monitor_type: &str, url: &str) -> Result<(), (StatusCode, String)> {
    let policy = net_guard::policy();
    let result = match monitor_type.to_uppercase().as_str() {
        "HEARTBEAT" => return Ok(()),
        "PORT" | "TCP" | "SSL" => policy.validate_host(&net_guard::extract_host(url)).await,
        _ => policy.validate_url(url).await,
    };
    result.map_err(|e| (StatusCode::BAD_REQUEST, format!("Target not allowed: {}", e)))
}

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub tx: Sender<WsMessage>,
    pub http_client: Arc<Client>,
    pub auth: Arc<AuthConfig>,
    pub webhook: Arc<WebhookConfig>,
    pub limits: Arc<RateLimits>,
    pub settings: Arc<AppSettings>,
}

#[derive(FromRow)]
struct UptimeCounts {
    pub total: i64,
    pub up: i64,
}

pub async fn list_monitors(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<MonitorWithStats>>, (StatusCode, String)> {
    let monitors: Vec<Monitor> = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE team_id = $1 ORDER BY created_at DESC"
    )
    .bind(auth.user.team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result = Vec::new();
    let now = Utc::now();
    let day_ago = now - Duration::days(1);
    let seven_days_ago = now - Duration::days(7);
    let thirty_days_ago = now - Duration::days(30);

    for m in monitors {
        let stats_24h: UptimeCounts = sqlx::query_as(
            r#"
            SELECT
                COUNT(*)::bigint as total,
                COUNT(*) FILTER (WHERE is_up = true)::bigint as up
            FROM check_results
            WHERE monitor_id = $1 AND checked_at >= $2
            "#
        )
        .bind(m.id)
        .bind(day_ago)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(UptimeCounts { total: 0, up: 0 });

        let uptime_24h = if stats_24h.total > 0 {
            (stats_24h.up as f64 / stats_24h.total as f64) * 100.0
        } else if m.status == "UP" {
            100.0
        } else {
            0.0
        };

        let stats_7d: UptimeCounts = sqlx::query_as(
            r#"
            SELECT
                COUNT(*)::bigint as total,
                COUNT(*) FILTER (WHERE is_up = true)::bigint as up
            FROM check_results
            WHERE monitor_id = $1 AND checked_at >= $2
            "#
        )
        .bind(m.id)
        .bind(seven_days_ago)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(UptimeCounts { total: 0, up: 0 });

        let uptime_7d = if stats_7d.total > 0 {
            (stats_7d.up as f64 / stats_7d.total as f64) * 100.0
        } else {
            uptime_24h
        };

        let stats_30d: UptimeCounts = sqlx::query_as(
            r#"
            SELECT
                COUNT(*)::bigint as total,
                COUNT(*) FILTER (WHERE is_up = true)::bigint as up
            FROM check_results
            WHERE monitor_id = $1 AND checked_at >= $2
            "#
        )
        .bind(m.id)
        .bind(thirty_days_ago)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(UptimeCounts { total: 0, up: 0 });

        let uptime_30d = if stats_30d.total > 0 {
            (stats_30d.up as f64 / stats_30d.total as f64) * 100.0
        } else {
            uptime_7d
        };

        // Recent 30 history points for bars
        let recent_checks: Vec<CheckResult> = sqlx::query_as::<_, CheckResult>(
            r#"
            SELECT * FROM check_results
            WHERE monitor_id = $1
            ORDER BY checked_at DESC
            LIMIT 30
            "#
        )
        .bind(m.id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let mut recent_history: Vec<UptimeBarPoint> = recent_checks
            .into_iter()
            .map(|c| UptimeBarPoint {
                timestamp: c.checked_at,
                is_up: c.is_up,
                response_time_ms: c.response_time_ms,
                status_code: c.status_code,
            })
            .collect();
        recent_history.reverse();

        result.push(MonitorWithStats {
            monitor: m,
            uptime_24h: (uptime_24h * 100.0).round() / 100.0,
            uptime_7d: (uptime_7d * 100.0).round() / 100.0,
            uptime_30d: (uptime_30d * 100.0).round() / 100.0,
            recent_history,
            latency_history: vec![],
        });
    }

    Ok(Json(result))
}

pub async fn get_monitor(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<MonitorWithStats>, (StatusCode, String)> {
    let monitor: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1 AND team_id = $2"
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Monitor not found".to_string()))?;

    let now = Utc::now();
    let day_ago = now - Duration::days(1);
    let seven_days_ago = now - Duration::days(7);
    let thirty_days_ago = now - Duration::days(30);

    let stats_24h: UptimeCounts = sqlx::query_as(
        r#"
        SELECT
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE is_up = true)::bigint as up
        FROM check_results
        WHERE monitor_id = $1 AND checked_at >= $2
        "#
    )
    .bind(monitor.id)
    .bind(day_ago)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(UptimeCounts { total: 0, up: 0 });

    let uptime_24h = if stats_24h.total > 0 {
        (stats_24h.up as f64 / stats_24h.total as f64) * 100.0
    } else {
        100.0
    };

    let stats_7d: UptimeCounts = sqlx::query_as(
        r#"
        SELECT
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE is_up = true)::bigint as up
        FROM check_results
        WHERE monitor_id = $1 AND checked_at >= $2
        "#
    )
    .bind(monitor.id)
    .bind(seven_days_ago)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(UptimeCounts { total: 0, up: 0 });

    let uptime_7d = if stats_7d.total > 0 {
        (stats_7d.up as f64 / stats_7d.total as f64) * 100.0
    } else {
        uptime_24h
    };

    let stats_30d: UptimeCounts = sqlx::query_as(
        r#"
        SELECT
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE is_up = true)::bigint as up
        FROM check_results
        WHERE monitor_id = $1 AND checked_at >= $2
        "#
    )
    .bind(monitor.id)
    .bind(thirty_days_ago)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(UptimeCounts { total: 0, up: 0 });

    let uptime_30d = if stats_30d.total > 0 {
        (stats_30d.up as f64 / stats_30d.total as f64) * 100.0
    } else {
        uptime_7d
    };

    let checks: Vec<CheckResult> = sqlx::query_as::<_, CheckResult>(
        r#"
        SELECT * FROM check_results
        WHERE monitor_id = $1
        ORDER BY checked_at DESC
        LIMIT 50
        "#
    )
    .bind(monitor.id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let mut latency_history = Vec::new();
    let mut recent_history = Vec::new();

    for c in checks.iter().rev() {
        latency_history.push(LatencyPoint {
            time: c.checked_at.format("%H:%M:%S").to_string(),
            latency: (c.response_time_ms * 10.0).round() / 10.0,
            status: c.status_code.unwrap_or(if c.is_up { 200 } else { 500 }),
        });
        recent_history.push(UptimeBarPoint {
            timestamp: c.checked_at,
            is_up: c.is_up,
            response_time_ms: c.response_time_ms,
            status_code: c.status_code,
        });
    }

    Ok(Json(MonitorWithStats {
        monitor,
        uptime_24h: (uptime_24h * 100.0).round() / 100.0,
        uptime_7d: (uptime_7d * 100.0).round() / 100.0,
        uptime_30d: (uptime_30d * 100.0).round() / 100.0,
        recent_history,
        latency_history,
    }))
}

pub async fn create_monitor(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateMonitorRequest>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to create monitors", auth.role.as_str()),
        ));
    }

    // Plan limits validation
    let team_plan: String = sqlx::query_scalar("SELECT plan FROM teams WHERE id = $1")
        .bind(auth.user.team_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap_or_else(|| "FREE".to_string());

    let (monitor_count,): (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM monitors WHERE team_id = $1")
        .bind(auth.user.team_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let plan_limits = plans::limits(&team_plan);
    if monitor_count >= plan_limits.max_monitors {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Monitor limit reached ({} max on the {} plan).{}",
                plan_limits.max_monitors,
                team_plan,
                state.settings.upgrade_hint()
            ),
        ));
    }

    validate_monitor_target(&payload.monitor_type, &payload.url).await?;

    let interval = payload.interval_seconds;
    let min_interval = plan_limits.min_interval_seconds;
    if interval < min_interval {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Minimum probe interval on the {} plan is {}s.{}",
                team_plan,
                min_interval,
                state.settings.upgrade_hint()
            ),
        ));
    }

    let headers_json = payload.headers.unwrap_or_else(|| serde_json::json!({}));
    let heartbeat_token = if payload.monitor_type.to_uppercase() == "HEARTBEAT" {
        Some(Uuid::new_v4().to_string().replace('-', ""))
    } else {
        None
    };
    let tags = payload.tags.unwrap_or_default();
    let group_name = payload.group_name.unwrap_or_else(|| "Default".to_string());
    let grace_seconds = payload.grace_seconds.unwrap_or(0);
    let slug = payload.slug.map(|s| s.trim().to_lowercase().replace(' ', "-")).filter(|s| !s.is_empty());
    let cron_expression = payload.cron_expression.map(|c| c.trim().to_string()).filter(|c| !c.is_empty());
    let timezone = payload.timezone.unwrap_or_else(|| "UTC".to_string());

    let next_expected_at = if let Some(ref cron_str) = cron_expression {
        if let Ok(cron) = std::str::FromStr::from_str(cron_str) {
            let tz: chrono_tz::Tz = timezone.parse().unwrap_or(chrono_tz::UTC);
            let now_tz = Utc::now().with_timezone(&tz);
            let c: croner::Cron = cron;
            c.find_next_occurrence(&now_tz, false).ok().map(|dt| dt.with_timezone(&Utc))
        } else {
            None
        }
    } else {
        None
    };

    let monitor = sqlx::query_as::<_, Monitor>(
        r#"
        INSERT INTO monitors (
            team_id, name, url, monitor_type, interval_seconds, timeout_seconds,
            method, headers, body, expected_status_code, keyword, port, heartbeat_token,
            auth_username, auth_password, tags, group_name, grace_seconds,
            slug, cron_expression, timezone, next_expected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *
        "#
    )
    .bind(auth.user.team_id)
    .bind(payload.name)
    .bind(payload.url)
    .bind(payload.monitor_type.to_uppercase())
    .bind(payload.interval_seconds)
    .bind(payload.timeout_seconds)
    .bind(payload.method.to_uppercase())
    .bind(headers_json)
    .bind(payload.body)
    .bind(payload.expected_status_code)
    .bind(payload.keyword)
    .bind(payload.port)
    .bind(heartbeat_token)
    .bind(payload.auth_username)
    .bind(payload.auth_password)
    .bind(tags)
    .bind(group_name)
    .bind(grace_seconds)
    .bind(slug)
    .bind(cron_expression)
    .bind(timezone)
    .bind(next_expected_at)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let pool = state.pool.clone();
    let client = state.http_client.clone();
    let m_clone = monitor.clone();
    let tx = state.tx.clone();
    if monitor.monitor_type.to_uppercase() != "HEARTBEAT" {
        tokio::spawn(async move {
            execute_single_probe(pool, client, m_clone, tx).await;
        });
    }

    Ok(Json(monitor))
}

pub async fn update_monitor(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMonitorRequest>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to update monitors", auth.role.as_str()),
        ));
    }

    let existing: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1 AND team_id = $2"
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Monitor not found".to_string()))?;

    if let Some(new_url) = payload.url.as_deref() {
        validate_monitor_target(&existing.monitor_type, new_url).await?;
    }

    let name = payload.name.unwrap_or(existing.name);
    let url = payload.url.unwrap_or(existing.url);
    let interval = payload.interval_seconds.unwrap_or(existing.interval_seconds);

    if let Some(req_interval) = payload.interval_seconds {
        let team_plan: String = sqlx::query_scalar("SELECT plan FROM teams WHERE id = $1")
            .bind(auth.user.team_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .unwrap_or_else(|| "FREE".to_string());

        let min_interval = plans::limits(&team_plan).min_interval_seconds;
        if req_interval < min_interval {
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "Minimum probe interval on the {} plan is {}s.{}",
                    team_plan,
                    min_interval,
                    state.settings.upgrade_hint()
                ),
            ));
        }
    }
    let timeout = payload.timeout_seconds.unwrap_or(existing.timeout_seconds);
    let method = payload.method.unwrap_or(existing.method);
    let headers = payload.headers.unwrap_or(existing.headers);
    let body = match payload.body {
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(s),
        None => existing.body,
    };
    let expected_code = payload.expected_status_code.or(existing.expected_status_code);
    let keyword = match payload.keyword {
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(s.trim().to_string()),
        None => existing.keyword,
    };
    let port = payload.port.or(existing.port);
    let auth_username = match payload.auth_username {
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(s.trim().to_string()),
        None => existing.auth_username,
    };
    let auth_password = match payload.auth_password {
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(s),
        None => existing.auth_password,
    };
    let tags = payload.tags.unwrap_or(existing.tags);
    let group_name = payload.group_name.unwrap_or(existing.group_name);
    let grace_seconds = payload.grace_seconds.unwrap_or(existing.grace_seconds);
    let slug = match payload.slug {
        Some(s) if s.trim().is_empty() => None,
        Some(s) => {
            let s_clean = s.trim().to_lowercase().replace(' ', "-");
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM monitors WHERE team_id = $1 AND slug = $2 AND id != $3)"
            )
            .bind(auth.user.team_id)
            .bind(&s_clean)
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            if exists {
                return Err((
                    StatusCode::BAD_REQUEST,
                    format!("Slug '{}' is already in use by another monitor in your team", s_clean),
                ));
            }
            Some(s_clean)
        }
        None => existing.slug,
    };
    let cron_expression = match payload.cron_expression {
        Some(s) if s.trim().is_empty() => None,
        Some(s) => {
            if croner::Cron::from_str(s.trim()).is_err() {
                return Err((
                    StatusCode::BAD_REQUEST,
                    format!("Invalid 5-field cron expression: '{}'", s),
                ));
            }
            Some(s.trim().to_string())
        }
        None => existing.cron_expression,
    };
    let timezone = payload.timezone.unwrap_or(existing.timezone);

    let next_expected_at = if let Some(ref cron_str) = cron_expression {
        if let Ok(cron) = std::str::FromStr::from_str(cron_str) {
            let tz: chrono_tz::Tz = timezone.parse().unwrap_or(chrono_tz::UTC);
            let now_tz = Utc::now().with_timezone(&tz);
            let c: croner::Cron = cron;
            c.find_next_occurrence(&now_tz, false).ok().map(|dt| dt.with_timezone(&Utc))
        } else {
            None
        }
    } else {
        None
    };

    let updated = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET name = $1, url = $2, interval_seconds = $3, timeout_seconds = $4,
            method = $5, headers = $6, body = $7, expected_status_code = $8,
            keyword = $9, port = $10, auth_username = $11, auth_password = $12,
            tags = $13, group_name = $14, grace_seconds = $15, slug = $16,
            cron_expression = $17, timezone = $18, next_expected_at = $19, updated_at = NOW()
        WHERE id = $20 AND team_id = $21
        RETURNING *
        "#
    )
    .bind(name)
    .bind(url)
    .bind(interval)
    .bind(timeout)
    .bind(method)
    .bind(headers)
    .bind(body)
    .bind(expected_code)
    .bind(keyword)
    .bind(port)
    .bind(auth_username)
    .bind(auth_password)
    .bind(tags)
    .bind(group_name)
    .bind(grace_seconds)
    .bind(slug)
    .bind(cron_expression)
    .bind(timezone)
    .bind(next_expected_at)
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = state.tx.send(WsMessage::MonitorUpdated(updated.clone()));
    Ok(Json(updated))
}

pub async fn delete_monitor(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to delete monitors", auth.role.as_str()),
        ));
    }

    sqlx::query("DELETE FROM monitors WHERE id = $1 AND team_id = $2")
        .bind(id)
        .bind(auth.user.team_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn pause_monitor(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to pause monitors", auth.role.as_str()),
        ));
    }

    let monitor = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET is_paused = TRUE, status = 'PAUSED', updated_at = NOW()
        WHERE id = $1 AND team_id = $2
        RETURNING *
        "#
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = state.tx.send(WsMessage::MonitorUpdated(monitor.clone()));
    Ok(Json(monitor))
}

pub async fn resume_monitor(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to resume monitors", auth.role.as_str()),
        ));
    }

    let monitor = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET is_paused = FALSE, status = 'PENDING', updated_at = NOW()
        WHERE id = $1 AND team_id = $2
        RETURNING *
        "#
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let pool = state.pool.clone();
    let client = state.http_client.clone();
    let m_clone = monitor.clone();
    let tx = state.tx.clone();
    tokio::spawn(async move {
        execute_single_probe(pool, client, m_clone, tx).await;
    });

    let _ = state.tx.send(WsMessage::MonitorUpdated(monitor.clone()));
    Ok(Json(monitor))
}

pub async fn trigger_test(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to test monitors", auth.role.as_str()),
        ));
    }

    let monitor: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1 AND team_id = $2"
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Monitor not found".to_string()))?;

    execute_single_probe(state.pool.clone(), state.http_client.clone(), monitor.clone(), state.tx.clone()).await;

    let updated: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1 AND team_id = $2"
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

pub async fn bulk_action(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<crate::models::BulkActionRequest>,
) -> Result<Json<crate::models::BulkActionResponse>, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to perform bulk actions", auth.role.as_str()),
        ));
    }

    if payload.ids.is_empty() {
        return Ok(Json(crate::models::BulkActionResponse {
            success: true,
            affected: 0,
            message: "No monitors selected".to_string(),
        }));
    }

    match payload.action.as_str() {
        "pause" => {
            let res = sqlx::query(
                "UPDATE monitors SET is_paused = TRUE, status = 'PAUSED', updated_at = NOW() WHERE id = ANY($1) AND team_id = $2"
            )
            .bind(&payload.ids)
            .bind(auth.user.team_id)
            .execute(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let affected = res.rows_affected() as usize;

            if let Ok(updated) = sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE id = ANY($1) AND team_id = $2")
                .bind(&payload.ids)
                .bind(auth.user.team_id)
                .fetch_all(&state.pool)
                .await
            {
                for m in updated {
                    let _ = state.tx.send(WsMessage::MonitorUpdated(m));
                }
            }

            Ok(Json(crate::models::BulkActionResponse {
                success: true,
                affected,
                message: format!("Successfully paused {} monitor(s)", affected),
            }))
        }
        "resume" => {
            let res = sqlx::query(
                "UPDATE monitors SET is_paused = FALSE, status = 'PENDING', updated_at = NOW() WHERE id = ANY($1) AND team_id = $2"
            )
            .bind(&payload.ids)
            .bind(auth.user.team_id)
            .execute(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let affected = res.rows_affected() as usize;

            if let Ok(updated) = sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE id = ANY($1) AND team_id = $2")
                .bind(&payload.ids)
                .bind(auth.user.team_id)
                .fetch_all(&state.pool)
                .await
            {
                for m in updated {
                    let pool = state.pool.clone();
                    let client = state.http_client.clone();
                    let tx = state.tx.clone();
                    let m_clone = m.clone();
                    tokio::spawn(async move {
                        execute_single_probe(pool, client, m_clone, tx).await;
                    });
                    let _ = state.tx.send(WsMessage::MonitorUpdated(m));
                }
            }

            Ok(Json(crate::models::BulkActionResponse {
                success: true,
                affected,
                message: format!("Successfully resumed {} monitor(s)", affected),
            }))
        }
        "delete" => {
            let res = sqlx::query("DELETE FROM monitors WHERE id = ANY($1) AND team_id = $2")
                .bind(&payload.ids)
                .bind(auth.user.team_id)
                .execute(&state.pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let affected = res.rows_affected() as usize;

            Ok(Json(crate::models::BulkActionResponse {
                success: true,
                affected,
                message: format!("Successfully deleted {} monitor(s)", affected),
            }))
        }
        "test" => {
            let selected = sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE id = ANY($1) AND team_id = $2")
                .bind(&payload.ids)
                .bind(auth.user.team_id)
                .fetch_all(&state.pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let affected = selected.len();
            for m in selected {
                let pool = state.pool.clone();
                let client = state.http_client.clone();
                let tx = state.tx.clone();
                tokio::spawn(async move {
                    execute_single_probe(pool, client, m, tx).await;
                });
            }

            Ok(Json(crate::models::BulkActionResponse {
                success: true,
                affected,
                message: format!("Triggered probes for {} monitor(s)", affected),
            }))
        }
        "set_group" => {
            let group = payload.value.unwrap_or_else(|| "Default".to_string());
            let res = sqlx::query(
                "UPDATE monitors SET group_name = $1, updated_at = NOW() WHERE id = ANY($2) AND team_id = $3"
            )
            .bind(&group)
            .bind(&payload.ids)
            .bind(auth.user.team_id)
            .execute(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let affected = res.rows_affected() as usize;
            if let Ok(updated) = sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE id = ANY($1) AND team_id = $2")
                .bind(&payload.ids)
                .bind(auth.user.team_id)
                .fetch_all(&state.pool)
                .await
            {
                for m in updated {
                    let _ = state.tx.send(WsMessage::MonitorUpdated(m));
                }
            }

            Ok(Json(crate::models::BulkActionResponse {
                success: true,
                affected,
                message: format!("Moved {} monitor(s) to folder '{}'", affected, group),
            }))
        }
        "add_tag" => {
            let tag = payload.value.ok_or((StatusCode::BAD_REQUEST, "Tag value required".to_string()))?;
            let tag_trimmed = tag.trim().to_lowercase().replace('#', "");
            let res = sqlx::query(
                "UPDATE monitors SET tags = array_append(tags, $1), updated_at = NOW() WHERE id = ANY($2) AND team_id = $3 AND NOT ($1 = ANY(tags))"
            )
            .bind(&tag_trimmed)
            .bind(&payload.ids)
            .bind(auth.user.team_id)
            .execute(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let affected = res.rows_affected() as usize;
            if let Ok(updated) = sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE id = ANY($1) AND team_id = $2")
                .bind(&payload.ids)
                .bind(auth.user.team_id)
                .fetch_all(&state.pool)
                .await
            {
                for m in updated {
                    let _ = state.tx.send(WsMessage::MonitorUpdated(m));
                }
            }

            Ok(Json(crate::models::BulkActionResponse {
                success: true,
                affected,
                message: format!("Added tag '#{}' to {} monitor(s)", tag_trimmed, affected),
            }))
        }
        _ => Err((StatusCode::BAD_REQUEST, format!("Unknown action '{}'", payload.action))),
    }
}
