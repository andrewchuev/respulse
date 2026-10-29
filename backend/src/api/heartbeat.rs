use crate::api::monitors::AppState;
use crate::models::{Incident, Monitor, WsMessage};
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::str::FromStr;
use uuid::Uuid;

enum HeartbeatSignal {
    Start,
    Success,
    Fail { error_message: String },
    Log,
}

pub async fn ping_heartbeat(
    State(state): State<AppState>,
    Path(token): Path<String>,
    body: Bytes,
) -> Result<Response, (StatusCode, String)> {
    let monitor: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE heartbeat_token = $1"
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Heartbeat token not found".to_string()))?;

    let (status, val) = execute_heartbeat_lifecycle(state, monitor, None, body).await?;
    Ok((status, Json(val)).into_response())
}

pub async fn ping_heartbeat_action(
    State(state): State<AppState>,
    Path((token, action)): Path<(String, String)>,
    body: Bytes,
) -> Result<Response, (StatusCode, String)> {
    let monitor: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE heartbeat_token = $1"
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Heartbeat token not found".to_string()))?;

    let (status, val) = execute_heartbeat_lifecycle(state, monitor, Some(action), body).await?;
    Ok((status, Json(val)).into_response())
}

pub async fn ping_by_slug(
    State(state): State<AppState>,
    Path((ping_key, slug)): Path<(String, String)>,
    Query(query): Query<HashMap<String, String>>,
    body: Bytes,
) -> Result<Response, (StatusCode, String)> {
    handle_slug_ping(state, ping_key, slug, None, query, body).await
}

pub async fn ping_by_slug_action(
    State(state): State<AppState>,
    Path((ping_key, slug, action)): Path<(String, String, String)>,
    Query(query): Query<HashMap<String, String>>,
    body: Bytes,
) -> Result<Response, (StatusCode, String)> {
    handle_slug_ping(state, ping_key, slug, Some(action), query, body).await
}

async fn handle_slug_ping(
    state: AppState,
    ping_key: String,
    slug: String,
    action: Option<String>,
    query: HashMap<String, String>,
    body: Bytes,
) -> Result<Response, (StatusCode, String)> {
    // 1. Look up team by ping_key
    let team_row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM teams WHERE ping_key = $1")
        .bind(&ping_key)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (team_id,) = team_row.ok_or((StatusCode::NOT_FOUND, "Invalid ping key".to_string()))?;

    let clean_slug = slug.trim().to_lowercase().replace(' ', "-");

    // 2. Look up monitor by (team_id, slug)
    let monitor_opt: Option<Monitor> = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE team_id = $1 AND slug = $2"
    )
    .bind(team_id)
    .bind(&clean_slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (monitor, is_created) = match monitor_opt {
        Some(m) => (m, false),
        None => {
            // Auto-provision if ?create=1
            if query.get("create").map(|v| v.as_str()) == Some("1") {
                let friendly_name = clean_slug
                    .replace('-', " ")
                    .split_whitespace()
                    .map(|w| {
                        let mut c = w.chars();
                        match c.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ");

                let heartbeat_token = Uuid::new_v4().to_string().replace('-', "");
                let created_monitor = sqlx::query_as::<_, Monitor>(
                    r#"
                    INSERT INTO monitors (
                        team_id, name, url, monitor_type, interval_seconds, timeout_seconds,
                        grace_seconds, heartbeat_token, slug, group_name, tags, status
                    ) VALUES ($1, $2, 'heartbeat://push', 'HEARTBEAT', 86400, 3600, 3600, $3, $4, 'Background Workers', ARRAY['cron', 'auto-provisioned'], 'PENDING')
                    RETURNING *
                    "#
                )
                .bind(team_id)
                .bind(friendly_name)
                .bind(heartbeat_token)
                .bind(&clean_slug)
                .fetch_one(&state.pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                (created_monitor, true)
            } else {
                return Err((
                    StatusCode::NOT_FOUND,
                    format!("Monitor with slug '{}' not found. Pass ?create=1 to auto-provision.", clean_slug),
                ));
            }
        }
    };

    let (status, mut val) = execute_heartbeat_lifecycle(state, monitor, action, body).await?;
    let resp_status = if is_created { StatusCode::CREATED } else { status };
    if is_created {
        if let Some(obj) = val.as_object_mut() {
            obj.insert("auto_provisioned".to_string(), json!(true));
            obj.insert("slug".to_string(), json!(clean_slug));
        }
    }

    Ok((resp_status, Json(val)).into_response())
}

fn calculate_next_expected(
    cron_expr: Option<&str>,
    tz_str: &str,
    from_utc: chrono::DateTime<Utc>,
) -> Option<chrono::DateTime<Utc>> {
    let cron_expr = cron_expr?;
    let cron = croner::Cron::from_str(cron_expr).ok()?;
    let tz: chrono_tz::Tz = tz_str.parse().unwrap_or(chrono_tz::UTC);
    let from_tz = from_utc.with_timezone(&tz);
    cron.find_next_occurrence(&from_tz, false)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

pub(crate) async fn execute_heartbeat_lifecycle(
    state: AppState,
    monitor: Monitor,
    action: Option<String>,
    body: Bytes,
) -> Result<(StatusCode, Value), (StatusCode, String)> {
    // Extract payload (up to 64KB)
    let payload = if !body.is_empty() {
        let max_len = 65536;
        let slice = if body.len() > max_len {
            &body[..max_len]
        } else {
            &body[..]
        };
        let text = String::from_utf8_lossy(slice).trim().to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    } else {
        None
    };

    let signal = match action.as_deref().map(|s| s.trim().to_lowercase()) {
        None => HeartbeatSignal::Success,
        Some(ref act) if act == "start" => HeartbeatSignal::Start,
        Some(ref act) if act == "log" => HeartbeatSignal::Log,
        Some(ref act) if act == "fail" || act == "error" || act == "down" => {
            let msg = payload.clone().unwrap_or_else(|| "Job explicitly reported failure via /fail signal".to_string());
            HeartbeatSignal::Fail { error_message: msg }
        }
        Some(ref act) if act == "0" || act == "ok" || act == "success" || act == "up" => {
            HeartbeatSignal::Success
        }
        Some(ref act) => {
            if let Ok(code) = act.parse::<i32>() {
                if code == 0 {
                    HeartbeatSignal::Success
                } else {
                    let msg = if let Some(ref p) = payload {
                        format!("Process exited with status code {}.\nCaptured Output:\n{}", code, p)
                    } else {
                        format!("Process exited with status code {}", code)
                    };
                    HeartbeatSignal::Fail { error_message: msg }
                }
            } else {
                HeartbeatSignal::Success
            }
        }
    };

    let now = Utc::now();
    let prev_status = monitor.status.clone();

    match signal {
        HeartbeatSignal::Start => {
            let _ = sqlx::query(
                r#"
                INSERT INTO check_results (
                    monitor_id, is_up, status_code, response_time_ms, checked_at, payload
                ) VALUES ($1, true, 200, 0.0, $2, $3)
                "#
            )
            .bind(monitor.id)
            .bind(now)
            .bind(&payload)
            .execute(&state.pool)
            .await;

            let updated = sqlx::query_as::<_, Monitor>(
                r#"
                UPDATE monitors
                SET last_start_at = $1,
                    last_payload = COALESCE($2, last_payload),
                    updated_at = $1
                WHERE id = $3
                RETURNING *
                "#
            )
            .bind(now)
            .bind(&payload)
            .bind(monitor.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let _ = state.tx.send(WsMessage::MonitorUpdated(updated));

            Ok((
                StatusCode::OK,
                json!({
                    "status": "ok",
                    "event": "start",
                    "message": "Start signal received. Task execution timer started.",
                    "timestamp": now
                }),
            ))
        }

        HeartbeatSignal::Log => {
            let is_up = prev_status == "UP";
            let _ = sqlx::query(
                r#"
                INSERT INTO check_results (
                    monitor_id, is_up, status_code, response_time_ms, checked_at, payload
                ) VALUES ($1, $2, 200, 0.0, $3, $4)
                "#
            )
            .bind(monitor.id)
            .bind(is_up)
            .bind(now)
            .bind(&payload)
            .execute(&state.pool)
            .await;

            let updated = sqlx::query_as::<_, Monitor>(
                r#"
                UPDATE monitors
                SET last_payload = COALESCE($1, last_payload),
                    updated_at = $2
                WHERE id = $3
                RETURNING *
                "#
            )
            .bind(&payload)
            .bind(now)
            .bind(monitor.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let _ = state.tx.send(WsMessage::MonitorUpdated(updated));

            Ok((
                StatusCode::OK,
                json!({
                    "status": "ok",
                    "event": "log",
                    "message": "Diagnostic log recorded.",
                    "timestamp": now
                }),
            ))
        }

        HeartbeatSignal::Fail { error_message } => {
            let duration_ms = if let Some(start) = monitor.last_start_at {
                (now - start).num_milliseconds().max(0) as f64
            } else {
                1.0
            };

            let _ = sqlx::query(
                r#"
                INSERT INTO check_results (
                    monitor_id, is_up, status_code, response_time_ms, error, payload, checked_at
                ) VALUES ($1, false, 500, $2, $3, $4, $5)
                "#
            )
            .bind(monitor.id)
            .bind(duration_ms)
            .bind(&error_message)
            .bind(&payload)
            .bind(now)
            .execute(&state.pool)
            .await;

            if prev_status != "DOWN" {
                let incident_id = Uuid::new_v4();
                let title = format!("{} Task Failure", monitor.name);
                let summary = format!("Task {} explicitly reported a failure signal.", monitor.name);
                let initial_update = format!("Failure signal: {}", error_message);

                let _ = sqlx::query(
                    r#"
                    INSERT INTO incidents (id, team_id, monitor_id, status, started_at, root_cause, title, severity, stage, summary)
                    VALUES ($1, $2, $3, 'ONGOING', NOW(), $4, $5, 'MAJOR', 'INVESTIGATING', $6)
                    "#
                )
                .bind(incident_id)
                .bind(monitor.team_id)
                .bind(monitor.id)
                .bind(&error_message)
                .bind(&title)
                .bind(&summary)
                .execute(&state.pool)
                .await;

                let _ = sqlx::query(
                    r#"
                    INSERT INTO incident_updates (incident_id, stage, message, author)
                    VALUES ($1, 'INVESTIGATING', $2, 'Heartbeat Engine')
                    "#
                )
                .bind(incident_id)
                .bind(&initial_update)
                .execute(&state.pool)
                .await;

                let inc = Incident {
                    id: incident_id,
                    team_id: monitor.team_id,
                    monitor_id: monitor.id,
                    status: "ONGOING".to_string(),
                    started_at: Utc::now(),
                    resolved_at: None,
                    duration_seconds: None,
                    root_cause: Some(error_message.clone()),
                    title: Some(title),
                    severity: "MAJOR".to_string(),
                    stage: "INVESTIGATING".to_string(),
                    summary: Some(summary),
                    post_mortem: None,
                    is_published: true,
                };
                let _ = state.tx.send(WsMessage::IncidentCreated(inc));

                crate::notifier::dispatch_alert(
                    &state.pool,
                    &state.http_client,
                    &monitor,
                    crate::notifier::AlertEvent::Down {
                        error: error_message.clone(),
                        incident_id: Some(incident_id),
                    },
                    Some(&state.tx),
                )
                .await;
            }

            let updated = sqlx::query_as::<_, Monitor>(
                r#"
                UPDATE monitors
                SET status = 'DOWN',
                    last_checked_at = $1,
                    last_status_change_at = CASE WHEN status != 'DOWN' THEN $1 ELSE last_status_change_at END,
                    last_response_time_ms = $2,
                    last_status_code = 500,
                    last_error = $3,
                    last_payload = COALESCE($4, last_payload),
                    last_duration_ms = $2,
                    updated_at = $1
                WHERE id = $5
                RETURNING *
                "#
            )
            .bind(now)
            .bind(duration_ms)
            .bind(&error_message)
            .bind(&payload)
            .bind(monitor.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let _ = state.tx.send(WsMessage::MonitorUpdated(updated));

            Ok((
                StatusCode::OK,
                json!({
                    "status": "error",
                    "event": "fail",
                    "error": error_message,
                    "duration_ms": duration_ms,
                    "timestamp": now
                }),
            ))
        }

        HeartbeatSignal::Success => {
            let duration_ms = if let Some(start) = monitor.last_start_at {
                if monitor.last_checked_at.map_or(true, |c| start > c) {
                    (now - start).num_milliseconds().max(0) as f64
                } else {
                    1.0
                }
            } else {
                1.0
            };

            let _ = sqlx::query(
                r#"
                INSERT INTO check_results (
                    monitor_id, is_up, status_code, response_time_ms, checked_at, payload
                ) VALUES ($1, true, 200, $2, $3, $4)
                "#
            )
            .bind(monitor.id)
            .bind(duration_ms)
            .bind(now)
            .bind(&payload)
            .execute(&state.pool)
            .await;

            if prev_status == "DOWN" {
                if let Ok(Some(inc)) = sqlx::query_as::<_, Incident>(
                    "SELECT * FROM incidents WHERE monitor_id = $1 AND status = 'ONGOING' ORDER BY started_at DESC LIMIT 1"
                )
                .bind(monitor.id)
                .fetch_optional(&state.pool)
                .await
                {
                    let duration = (now - inc.started_at).num_seconds() as i32;
                    let _ = sqlx::query(
                        "UPDATE incidents SET status = 'RESOLVED', stage = 'RESOLVED', resolved_at = $1, duration_seconds = $2 WHERE id = $3"
                    )
                    .bind(now)
                    .bind(duration)
                    .bind(inc.id)
                    .execute(&state.pool)
                    .await;

                    let recovery_msg = format!("Task recovered and is signaling normally. Total downtime: {}s.", duration);
                    let _ = sqlx::query(
                        "INSERT INTO incident_updates (incident_id, stage, message, author) VALUES ($1, 'RESOLVED', $2, 'Heartbeat Engine')"
                    )
                    .bind(inc.id)
                    .bind(&recovery_msg)
                    .execute(&state.pool)
                    .await;

                    let mut resolved = inc.clone();
                    resolved.status = "RESOLVED".to_string();
                    resolved.stage = "RESOLVED".to_string();
                    resolved.resolved_at = Some(now);
                    resolved.duration_seconds = Some(duration);
                    let _ = state.tx.send(WsMessage::IncidentResolved(resolved));

                    crate::notifier::dispatch_alert(
                        &state.pool,
                        &state.http_client,
                        &monitor,
                        crate::notifier::AlertEvent::Resolved {
                            duration_seconds: duration,
                            incident_id: Some(inc.id),
                        },
                        Some(&state.tx),
                    )
                    .await;
                }
            }

            // Calculate next expected run if cron expression is configured
            let next_expected_at = calculate_next_expected(monitor.cron_expression.as_deref(), &monitor.timezone, now);

            let updated = sqlx::query_as::<_, Monitor>(
                r#"
                UPDATE monitors
                SET status = 'UP',
                    last_checked_at = $1,
                    last_status_change_at = CASE WHEN status != 'UP' THEN $1 ELSE last_status_change_at END,
                    last_response_time_ms = $2,
                    last_status_code = 200,
                    last_error = NULL,
                    last_payload = COALESCE($3, last_payload),
                    last_duration_ms = $2,
                    next_expected_at = COALESCE($4, next_expected_at),
                    updated_at = $1
                WHERE id = $5
                RETURNING *
                "#
            )
            .bind(now)
            .bind(duration_ms)
            .bind(&payload)
            .bind(next_expected_at)
            .bind(monitor.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let _ = state.tx.send(WsMessage::MonitorUpdated(updated));

            Ok((
                StatusCode::OK,
                json!({
                    "status": "ok",
                    "event": "success",
                    "duration_ms": duration_ms,
                    "next_expected_at": next_expected_at,
                    "timestamp": now
                }),
            ))
        }
    }
}
