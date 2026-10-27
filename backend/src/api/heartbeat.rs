use crate::api::monitors::AppState;
use crate::models::{Incident, Monitor, WsMessage};
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use serde_json::{json, Value};

pub async fn ping_heartbeat(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let monitor: Monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE heartbeat_token = $1"
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Heartbeat token not found".to_string()))?;

    let now = Utc::now();
    let prev_status = monitor.status.clone();

    let _ = sqlx::query(
        r#"
        INSERT INTO check_results (
            monitor_id, is_up, status_code, response_time_ms, checked_at
        ) VALUES ($1, true, 200, 1.0, $2)
        "#
    )
    .bind(monitor.id)
    .bind(now)
    .execute(&state.pool)
    .await;

    if prev_status == "DOWN" {
        if let Ok(Some(inc)) = sqlx::query_as::<_, Incident>(
            "SELECT * FROM incidents WHERE monitor_id = $1 AND status = 'ONGOING' ORDER BY started_at DESC LIMIT 1"
        )
        .bind(monitor.id)
        .fetch_optional(&state.pool)
        .await {
            let duration = (now - inc.started_at).num_seconds() as i32;
            let _ = sqlx::query(
                "UPDATE incidents SET status = 'RESOLVED', resolved_at = $1, duration_seconds = $2 WHERE id = $3"
            )
            .bind(now)
            .bind(duration)
            .bind(inc.id)
            .execute(&state.pool)
            .await;

            let mut resolved = inc;
            resolved.status = "RESOLVED".to_string();
            resolved.resolved_at = Some(now);
            resolved.duration_seconds = Some(duration);
            let _ = state.tx.send(WsMessage::IncidentResolved(resolved));
        }
    }

    let updated = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET status = 'UP',
            last_checked_at = $1,
            last_response_time_ms = 1.0,
            last_status_code = 200,
            last_error = NULL,
            updated_at = $1
        WHERE id = $2
        RETURNING *
        "#
    )
    .bind(now)
    .bind(monitor.id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = state.tx.send(WsMessage::MonitorUpdated(updated));

    Ok(Json(json!({
        "status": "ok",
        "message": "Heartbeat received",
        "timestamp": now
    })))
}
