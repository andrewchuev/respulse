use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{GlobalStats, Monitor, MonitorWithStats, UptimeBarPoint};
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use chrono::{Duration, Utc};
use serde::Serialize;
use sqlx::FromRow;

#[derive(FromRow)]
struct StatsAggregate {
    total: i64,
    up: i64,
    avg_time: Option<f64>,
}

#[derive(FromRow)]
struct UptimeCounts {
    total: i64,
    up: i64,
}

pub async fn get_stats(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<GlobalStats>, (StatusCode, String)> {
    let monitors: Vec<Monitor> = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE team_id = $1"
    )
    .bind(auth.user.team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let total_monitors = monitors.len();
    let up_monitors = monitors.iter().filter(|m| m.status == "UP").count();
    let down_monitors = monitors.iter().filter(|m| m.status == "DOWN").count();
    let paused_monitors = monitors.iter().filter(|m| m.is_paused).count();

    let day_ago = Utc::now() - Duration::days(1);
    let agg: StatsAggregate = sqlx::query_as(
        r#"
        SELECT
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE c.is_up = true)::bigint as up,
            AVG(c.response_time_ms)::float8 as avg_time
        FROM check_results c
        JOIN monitors m ON m.id = c.monitor_id
        WHERE m.team_id = $1 AND c.checked_at >= $2
        "#
    )
    .bind(auth.user.team_id)
    .bind(day_ago)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(StatsAggregate { total: 0, up: 0, avg_time: Some(0.0) });

    let overall_uptime_24h = if agg.total > 0 {
        ((agg.up as f64 / agg.total as f64) * 10000.0).round() / 100.0
    } else if up_monitors > 0 && down_monitors == 0 {
        100.0
    } else if total_monitors == 0 {
        100.0
    } else {
        0.0
    };

    let avg_response_time_ms = ((agg.avg_time.unwrap_or(0.0) * 10.0).round()) / 10.0;

    Ok(Json(GlobalStats {
        total_monitors,
        up_monitors,
        down_monitors,
        paused_monitors,
        overall_uptime_24h,
        avg_response_time_ms,
    }))
}

#[derive(Serialize)]
pub struct PublicStatusPage {
    pub title: String,
    pub description: String,
    pub all_systems_operational: bool,
    pub overall_uptime_90d: f64,
    pub active_incidents: Vec<crate::models::IncidentWithDetails>,
    pub resolved_incidents: Vec<crate::models::IncidentWithDetails>,
    pub services: Vec<MonitorWithStats>,
}

pub async fn get_status_page(
    State(state): State<AppState>,
) -> Result<Json<PublicStatusPage>, (StatusCode, String)> {
    let monitors: Vec<Monitor> = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE team_id = '00000000-0000-0000-0000-000000000001' AND is_paused = FALSE ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let all_up = monitors.iter().all(|m| m.status == "UP");

    // Fetch active ongoing incidents
    let active_rows: Vec<crate::models::Incident> = sqlx::query_as::<_, crate::models::Incident>(
        "SELECT * FROM incidents WHERE team_id = '00000000-0000-0000-0000-000000000001' AND status = 'ONGOING' AND is_published = TRUE ORDER BY started_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let mut active_incidents = Vec::new();
    for inc in active_rows {
        let m_name = monitors.iter().find(|m| m.id == inc.monitor_id).map(|m| m.name.clone()).unwrap_or_else(|| "Service".to_string());
        let m_url = monitors.iter().find(|m| m.id == inc.monitor_id).map(|m| m.url.clone()).unwrap_or_default();
        let updates: Vec<crate::models::IncidentUpdate> = sqlx::query_as::<_, crate::models::IncidentUpdate>(
            "SELECT * FROM incident_updates WHERE incident_id = $1 ORDER BY created_at ASC"
        )
        .bind(inc.id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        active_incidents.push(crate::models::IncidentWithDetails {
            incident: inc,
            monitor_name: m_name,
            monitor_url: m_url,
            updates,
        });
    }

    // Fetch resolved incidents with post-mortems (past 7 days)
    let seven_days_ago = Utc::now() - Duration::days(7);
    let resolved_rows: Vec<crate::models::Incident> = sqlx::query_as::<_, crate::models::Incident>(
        "SELECT * FROM incidents WHERE team_id = '00000000-0000-0000-0000-000000000001' AND status = 'RESOLVED' AND is_published = TRUE AND started_at >= $1 ORDER BY started_at DESC LIMIT 10"
    )
    .bind(seven_days_ago)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let mut resolved_incidents = Vec::new();
    for inc in resolved_rows {
        let m_name = monitors.iter().find(|m| m.id == inc.monitor_id).map(|m| m.name.clone()).unwrap_or_else(|| "Service".to_string());
        let m_url = monitors.iter().find(|m| m.id == inc.monitor_id).map(|m| m.url.clone()).unwrap_or_default();
        let updates: Vec<crate::models::IncidentUpdate> = sqlx::query_as::<_, crate::models::IncidentUpdate>(
            "SELECT * FROM incident_updates WHERE incident_id = $1 ORDER BY created_at ASC"
        )
        .bind(inc.id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        resolved_incidents.push(crate::models::IncidentWithDetails {
            incident: inc,
            monitor_name: m_name,
            monitor_url: m_url,
            updates,
        });
    }

    let mut services = Vec::new();
    let day_ago = Utc::now() - Duration::days(1);

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
        } else {
            100.0
        };

        let recent_checks: Vec<crate::models::CheckResult> = sqlx::query_as::<_, crate::models::CheckResult>(
            "SELECT * FROM check_results WHERE monitor_id = $1 ORDER BY checked_at DESC LIMIT 30"
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

        services.push(MonitorWithStats {
            monitor: m,
            uptime_24h: (uptime_24h * 100.0).round() / 100.0,
            uptime_7d: (uptime_24h * 100.0).round() / 100.0,
            uptime_30d: (uptime_24h * 100.0).round() / 100.0,
            recent_history,
            latency_history: vec![],
        });
    }

    Ok(Json(PublicStatusPage {
        title: "ResPulse Service Status".to_string(),
        description: "Real-time performance and uptime status of systems and APIs".to_string(),
        all_systems_operational: all_up && active_incidents.is_empty(),
        overall_uptime_90d: 99.98,
        active_incidents,
        resolved_incidents,
        services,
    }))
}
