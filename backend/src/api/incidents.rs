use crate::api::monitors::AppState;
use crate::models::Incident;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Serialize)]
pub struct IncidentWithMonitor {
    #[serde(flatten)]
    pub incident: Incident,
    pub monitor_name: String,
    pub monitor_url: String,
}

#[derive(FromRow)]
struct IncidentRow {
    pub id: Uuid,
    pub monitor_id: Uuid,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub root_cause: Option<String>,
    pub monitor_name: String,
    pub monitor_url: String,
}

pub async fn list_incidents(
    State(state): State<AppState>,
) -> Result<Json<Vec<IncidentWithMonitor>>, (StatusCode, String)> {
    let rows: Vec<IncidentRow> = sqlx::query_as(
        r#"
        SELECT
            i.id,
            i.monitor_id,
            i.status,
            i.started_at,
            i.resolved_at,
            i.duration_seconds,
            i.root_cause,
            m.name as monitor_name,
            m.url as monitor_url
        FROM incidents i
        JOIN monitors m ON i.monitor_id = m.id
        ORDER BY i.started_at DESC
        LIMIT 100
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let list = rows
        .into_iter()
        .map(|r| IncidentWithMonitor {
            incident: Incident {
                id: r.id,
                monitor_id: r.monitor_id,
                status: r.status,
                started_at: r.started_at,
                resolved_at: r.resolved_at,
                duration_seconds: r.duration_seconds,
                root_cause: r.root_cause,
            },
            monitor_name: r.monitor_name,
            monitor_url: r.monitor_url,
        })
        .collect();

    Ok(Json(list))
}
