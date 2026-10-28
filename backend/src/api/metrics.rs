use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};

use crate::api::monitors::AppState;
use crate::auth::user_from_token;

/// Prometheus scrapers send a static `Authorization: Bearer` credential: either the team's
/// Ping Key (long-lived, fits `authorization.credentials`) or a user JWT.
async fn scrape_team_id(state: &AppState, headers: &HeaderMap) -> Result<uuid::Uuid, (StatusCode, String)> {
    let unauthorized = || (StatusCode::UNAUTHORIZED, "Unauthorized: bearer token required".to_string());

    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or_else(unauthorized)?;

    if let Some(user) = user_from_token(&state.auth, &state.pool, token).await {
        return Ok(user.team_id);
    }

    sqlx::query_scalar::<_, uuid::Uuid>("SELECT id FROM teams WHERE ping_key = $1")
        .bind(token)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(unauthorized)
}

pub async fn get_prometheus_metrics(
    State(state): State<AppState>,
    request_headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let team_id = scrape_team_id(&state, &request_headers).await?;

    // Prometheus export is a Pro feature; it stays off for Free teams during the open beta.
    let plan: Option<String> = sqlx::query_scalar("SELECT plan FROM teams WHERE id = $1")
        .bind(team_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if plan.as_deref() != Some("PRO") {
        return Err((
            StatusCode::FORBIDDEN,
            "Prometheus export is a Pro feature and is not available during the free beta".to_string(),
        ));
    }

    #[derive(sqlx::FromRow)]
    struct MonitorMetricRow {
        id: uuid::Uuid,
        name: String,
        monitor_type: String,
        status: String,
        is_paused: bool,
        last_response_time_ms: Option<f64>,
        last_duration_ms: Option<f64>,
        slug: Option<String>,
        team_name: String,
    }

    let rows = sqlx::query_as::<_, MonitorMetricRow>(
        r#"
        SELECT 
            m.id, m.name, m.monitor_type, m.status, m.is_paused,
            m.last_response_time_ms, m.last_duration_ms, m.slug,
            COALESCE(t.name, 'Default') as team_name
        FROM monitors m
        LEFT JOIN teams t ON t.id = m.team_id
        WHERE m.team_id = $1
        ORDER BY m.name ASC
        "#
    )
    .bind(team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (active_incidents,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM incidents WHERE team_id = $1 AND status != 'RESOLVED'"
    )
    .bind(team_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or((0,));

    let mut total_up = 0;
    let mut total_down = 0;
    let mut total_pending = 0;
    let mut total_paused = 0;

    for r in &rows {
        if r.is_paused {
            total_paused += 1;
        } else {
            match r.status.as_str() {
                "UP" => total_up += 1,
                "DOWN" => total_down += 1,
                _ => total_pending += 1,
            }
        }
    }

    let mut out = String::with_capacity(4096);
    out.push_str("# HELP respulse_monitors_total Total count of configured monitors by operational state\n");
    out.push_str("# TYPE respulse_monitors_total gauge\n");
    out.push_str(&format!("respulse_monitors_total{{status=\"UP\"}} {}\n", total_up));
    out.push_str(&format!("respulse_monitors_total{{status=\"DOWN\"}} {}\n", total_down));
    out.push_str(&format!("respulse_monitors_total{{status=\"PENDING\"}} {}\n", total_pending));
    out.push_str(&format!("respulse_monitors_total{{status=\"PAUSED\"}} {}\n", total_paused));
    out.push('\n');

    out.push_str("# HELP respulse_incidents_active_total Total count of currently active unresolved incidents\n");
    out.push_str("# TYPE respulse_incidents_active_total gauge\n");
    out.push_str(&format!("respulse_incidents_active_total {}\n\n", active_incidents));

    out.push_str("# HELP respulse_monitor_status Current status of each monitor (1 = UP, 0 = DOWN/PENDING, -1 = PAUSED)\n");
    out.push_str("# TYPE respulse_monitor_status gauge\n");
    for r in &rows {
        let code = if r.is_paused {
            -1
        } else if r.status == "UP" {
            1
        } else {
            0
        };
        let safe_name = r.name.replace('"', "\\\"");
        let safe_team = r.team_name.replace('"', "\\\"");
        out.push_str(&format!(
            "respulse_monitor_status{{id=\"{}\",name=\"{}\",type=\"{}\",team=\"{}\"}} {}\n",
            r.id, safe_name, r.monitor_type, safe_team, code
        ));
    }
    out.push('\n');

    out.push_str("# HELP respulse_monitor_response_time_ms Last probe or response latency in milliseconds\n");
    out.push_str("# TYPE respulse_monitor_response_time_ms gauge\n");
    for r in &rows {
        if let Some(ms) = r.last_response_time_ms {
            let safe_name = r.name.replace('"', "\\\"");
            let safe_team = r.team_name.replace('"', "\\\"");
            out.push_str(&format!(
                "respulse_monitor_response_time_ms{{id=\"{}\",name=\"{}\",type=\"{}\",team=\"{}\"}} {:.2}\n",
                r.id, safe_name, r.monitor_type, safe_team, ms
            ));
        }
    }
    out.push('\n');

    out.push_str("# HELP respulse_heartbeat_duration_ms Execution duration of last heartbeat task run in milliseconds\n");
    out.push_str("# TYPE respulse_heartbeat_duration_ms gauge\n");
    for r in &rows {
        if let Some(ms) = r.last_duration_ms {
            let safe_name = r.name.replace('"', "\\\"");
            let slug_val = r.slug.as_deref().unwrap_or("none");
            out.push_str(&format!(
                "respulse_heartbeat_duration_ms{{id=\"{}\",name=\"{}\",slug=\"{}\"}} {:.2}\n",
                r.id, safe_name, slug_val, ms
            ));
        }
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
    );

    Ok((headers, out))
}
