use crate::db::DbPool;
use crate::models::{
    CheckResult, CreateMonitorRequest, LatencyPoint, Monitor, MonitorWithStats,
    UptimeBarPoint, UpdateMonitorRequest, WsMessage,
};
use crate::probe::runner::execute_single_probe;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{Duration, Utc};
use reqwest::Client;
use sqlx::FromRow;
use std::sync::Arc;
use tokio::sync::broadcast::Sender;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub tx: Sender<WsMessage>,
    pub http_client: Arc<Client>,
}

#[derive(FromRow)]
struct UptimeCounts {
    pub total: i64,
    pub up: i64,
}

pub async fn list_monitors(State(state): State<AppState>) -> Result<Json<Vec<MonitorWithStats>>, (StatusCode, String)> {
    let monitors: Vec<Monitor> = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors ORDER BY created_at DESC"
    )
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
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<MonitorWithStats>, (StatusCode, String)> {
    let monitor: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1"
    )
    .bind(id)
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
    State(state): State<AppState>,
    Json(payload): Json<CreateMonitorRequest>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    let headers_json = payload.headers.unwrap_or_else(|| serde_json::json!({}));
    let heartbeat_token = if payload.monitor_type.to_uppercase() == "HEARTBEAT" {
        Some(Uuid::new_v4().to_string().replace('-', ""))
    } else {
        None
    };

    let monitor = sqlx::query_as::<_, Monitor>(
        r#"
        INSERT INTO monitors (
            name, url, monitor_type, interval_seconds, timeout_seconds,
            method, headers, body, expected_status_code, keyword, port, heartbeat_token,
            auth_username, auth_password
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        "#
    )
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

    Ok(Json(monitor))
}

pub async fn update_monitor(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMonitorRequest>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    let existing: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Monitor not found".to_string()))?;

    let name = payload.name.unwrap_or(existing.name);
    let url = payload.url.unwrap_or(existing.url);
    let interval = payload.interval_seconds.unwrap_or(existing.interval_seconds);
    let timeout = payload.timeout_seconds.unwrap_or(existing.timeout_seconds);
    let method = payload.method.unwrap_or(existing.method);
    let headers = payload.headers.unwrap_or(existing.headers);
    let body = payload.body.or(existing.body);
    let expected_code = payload.expected_status_code.or(existing.expected_status_code);
    let keyword = payload.keyword.or(existing.keyword);
    let port = payload.port.or(existing.port);
    let auth_username = payload.auth_username.or(existing.auth_username);
    let auth_password = payload.auth_password.or(existing.auth_password);

    let updated = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET name = $1, url = $2, interval_seconds = $3, timeout_seconds = $4,
            method = $5, headers = $6, body = $7, expected_status_code = $8,
            keyword = $9, port = $10, auth_username = $11, auth_password = $12, updated_at = NOW()
        WHERE id = $13
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
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = state.tx.send(WsMessage::MonitorUpdated(updated.clone()));
    Ok(Json(updated))
}

pub async fn delete_monitor(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    sqlx::query("DELETE FROM monitors WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn pause_monitor(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    let monitor = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET is_paused = TRUE, status = 'PAUSED', updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = state.tx.send(WsMessage::MonitorUpdated(monitor.clone()));
    Ok(Json(monitor))
}

pub async fn resume_monitor(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    let monitor = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET is_paused = FALSE, status = 'PENDING', updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#
    )
    .bind(id)
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
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    let monitor: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Monitor not found".to_string()))?;

    execute_single_probe(state.pool.clone(), state.http_client.clone(), monitor.clone(), state.tx.clone()).await;

    let updated: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = $1"
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}
