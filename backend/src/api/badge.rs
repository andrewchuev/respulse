use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::api::monitors::AppState;
use crate::models::Monitor;

#[derive(Debug, Deserialize)]
pub struct BadgeQuery {
    pub label: Option<String>,
    pub style: Option<String>,
}

pub async fn get_badge_by_token(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Query(query): Query<BadgeQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let clean_token = token.trim_end_matches(".svg");

    let monitor = if let Ok(uuid) = Uuid::parse_str(clean_token) {
        sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE id = $1 OR heartbeat_token = $2")
            .bind(uuid)
            .bind(clean_token)
            .fetch_optional(&state.pool)
            .await
    } else {
        sqlx::query_as::<_, Monitor>("SELECT * FROM monitors WHERE heartbeat_token = $1")
            .bind(clean_token)
            .fetch_optional(&state.pool)
            .await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let monitor = match monitor {
        Some(m) => m,
        None => return Ok(render_svg_badge("status", "not found", "#9f9f9f")),
    };

    Ok(render_monitor_badge(&monitor, query))
}

pub async fn get_badge_by_slug(
    State(state): State<AppState>,
    Path((ping_key, slug)): Path<(String, String)>,
    Query(query): Query<BadgeQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let clean_slug = slug.trim_end_matches(".svg").to_lowercase();

    // Look up team by ping_key
    let team_row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM teams WHERE ping_key = $1")
        .bind(&ping_key)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (team_id,) = match team_row {
        Some(row) => row,
        None => return Ok(render_svg_badge("status", "team not found", "#9f9f9f")),
    };

    let monitor: Option<Monitor> = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE team_id = $1 AND slug = $2"
    )
    .bind(team_id)
    .bind(&clean_slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let monitor = match monitor {
        Some(m) => m,
        None => return Ok(render_svg_badge("status", "not found", "#9f9f9f")),
    };

    Ok(render_monitor_badge(&monitor, query))
}

fn render_monitor_badge(monitor: &Monitor, query: BadgeQuery) -> (HeaderMap, String) {
    let label = query.label.unwrap_or_else(|| {
        if let Some(ref slug) = monitor.slug {
            slug.clone()
        } else {
            monitor.name.clone()
        }
    });

    let now = Utc::now();
    let (status_text, color) = if monitor.is_paused {
        ("paused", "#6b7280")
    } else if monitor.status == "DOWN" {
        ("down", "#ef4444")
    } else if monitor.status == "PENDING" {
        ("pending", "#3b82f6")
    } else {
        // UP: check if currently in grace period
        let is_in_grace = if let Some(next_exp) = monitor.next_expected_at {
            let grace_sec = monitor.grace_seconds as i64;
            now > next_exp && now <= next_exp + Duration::seconds(grace_sec)
        } else if let Some(last_chk) = monitor.last_checked_at {
            let int_sec = monitor.interval_seconds as i64;
            let grace_sec = monitor.grace_seconds as i64;
            let due = last_chk + Duration::seconds(int_sec);
            now > due && now <= due + Duration::seconds(grace_sec)
        } else {
            false
        };

        if is_in_grace {
            ("late", "#f59e0b")
        } else {
            ("up", "#10b981")
        }
    };

    render_svg_badge(&label, status_text, color)
}

fn render_svg_badge(label: &str, status: &str, color: &str) -> (HeaderMap, String) {
    let sanitize = |s: &str| -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    };
    let clean_label = sanitize(label);
    let clean_status = sanitize(status);

    // Approximate character width in Verdana 11
    let char_width = 7.0;
    let pad = 12.0;
    let left_width = ((clean_label.len() as f64 * char_width) + pad).max(35.0).round() as u32;
    let right_width = ((clean_status.len() as f64 * char_width) + pad).max(30.0).round() as u32;
    let total_width = left_width + right_width;

    let left_x = (left_width * 10) / 2;
    let right_x = (left_width * 10) + ((right_width * 10) / 2);

    let svg = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="{clean_label}: {clean_status}">
  <title>{clean_label}: {clean_status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="{total_width}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="{left_width}" height="20" fill="#555"/>
    <rect x="{left_width}" width="{right_width}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="{left_x}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">{clean_label}</text>
    <text x="{left_x}" y="140" transform="scale(.1)" fill="#fff">{clean_label}</text>
    <text aria-hidden="true" x="{right_x}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">{clean_status}</text>
    <text x="{right_x}" y="140" transform="scale(.1)" fill="#fff">{clean_status}</text>
  </g>
</svg>"##
    );

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("image/svg+xml"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache, no-store, must-revalidate"));
    headers.insert(header::PRAGMA, HeaderValue::from_static("no-cache"));
    headers.insert(header::EXPIRES, HeaderValue::from_static("0"));

    (headers, svg)
}
