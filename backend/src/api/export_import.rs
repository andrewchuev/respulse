use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::{Monitor, NotificationChannel};
use crate::plans;
use crate::probe::runner::execute_single_probe;
use super::monitors::{validate_monitor_target, AppState};
use super::notifications::validate_channel_config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResPulseExport {
    pub version: u32,
    pub exported_at: DateTime<Utc>,
    pub app: String,
    pub team_name: Option<String>,
    #[serde(default)]
    pub monitors: Vec<ExportMonitorItem>,
    #[serde(default)]
    pub notification_channels: Vec<ExportChannelItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportMonitorItem {
    pub name: String,
    pub url: String,
    #[serde(default = "default_monitor_type")]
    pub monitor_type: String,
    #[serde(default = "default_interval")]
    pub interval_seconds: i32,
    #[serde(default = "default_timeout")]
    pub timeout_seconds: i32,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: serde_json::Value,
    pub body: Option<String>,
    pub expected_status_code: Option<i32>,
    pub keyword: Option<String>,
    pub port: Option<i32>,
    pub auth_username: Option<String>,
    pub auth_password: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_group_name")]
    pub group_name: String,
    #[serde(default)]
    pub grace_seconds: i32,
    pub slug: Option<String>,
    pub cron_expression: Option<String>,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default)]
    pub is_paused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportChannelItem {
    pub name: String,
    pub channel_type: String,
    pub config: serde_json::Value,
    #[serde(default = "default_true")]
    pub is_active: bool,
    #[serde(default)]
    pub filter_tags: Vec<String>,
}

fn default_monitor_type() -> String { "HTTP".to_string() }
fn default_interval() -> i32 { 60 }
fn default_timeout() -> i32 { 10 }
fn default_method() -> String { "GET".to_string() }
fn default_group_name() -> String { "Default".to_string() }
fn default_timezone() -> String { "UTC".to_string() }
fn default_true() -> bool { true }

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    #[serde(default = "default_true")]
    pub include_secrets: bool,
}

/// GET /api/config/export
/// Exports all monitors and notification channels for the authenticated team.
pub async fn export_config(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ExportQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Only allow export for authenticated users
    let include_secrets = query.include_secrets && auth.role.can_mutate_monitors();

    let team_name: Option<String> = sqlx::query_scalar("SELECT name FROM teams WHERE id = $1")
        .bind(auth.user.team_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Fetch team monitors
    let monitors = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE team_id = $1 ORDER BY group_name, name"
    )
    .bind(auth.user.team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Fetch team notification channels
    let channels = sqlx::query_as::<_, NotificationChannel>(
        "SELECT * FROM notification_channels WHERE team_id = $1 ORDER BY name"
    )
    .bind(auth.user.team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let export_monitors: Vec<ExportMonitorItem> = monitors
        .into_iter()
        .map(|m| {
            let auth_password = if include_secrets {
                m.auth_password
            } else {
                None
            };

            ExportMonitorItem {
                name: m.name,
                url: m.url,
                monitor_type: m.monitor_type,
                interval_seconds: m.interval_seconds,
                timeout_seconds: m.timeout_seconds,
                method: m.method,
                headers: m.headers,
                body: m.body,
                expected_status_code: m.expected_status_code,
                keyword: m.keyword,
                port: m.port,
                auth_username: m.auth_username,
                auth_password,
                tags: m.tags,
                group_name: m.group_name,
                grace_seconds: m.grace_seconds,
                slug: m.slug,
                cron_expression: m.cron_expression,
                timezone: m.timezone,
                is_paused: m.is_paused,
            }
        })
        .collect();

    let export_channels: Vec<ExportChannelItem> = channels
        .into_iter()
        .map(|c| {
            let mut config = c.config;
            if !include_secrets {
                if let Some(obj) = config.as_object_mut() {
                    if let Some(bot_token) = obj.get_mut("bot_token") {
                        *bot_token = serde_json::Value::String("********".to_string());
                    }
                    if let Some(webhook_url) = obj.get_mut("webhook_url") {
                        if let Some(url_str) = webhook_url.as_str() {
                            if url_str.len() > 15 {
                                *webhook_url = serde_json::Value::String(format!("{}...", &url_str[..12]));
                            }
                        }
                    }
                }
            }

            ExportChannelItem {
                name: c.name,
                channel_type: c.channel_type,
                config,
                is_active: c.is_active,
                filter_tags: c.filter_tags,
            }
        })
        .collect();

    let export_data = ResPulseExport {
        version: 1,
        exported_at: Utc::now(),
        app: "ResPulse".to_string(),
        team_name: team_name.clone(),
        monitors: export_monitors,
        notification_channels: export_channels,
    };

    let filename = format!(
        "respulse-config-{}-{}.json",
        team_name.as_deref().unwrap_or("team").to_lowercase().replace(' ', "-"),
        Utc::now().format("%Y%m%d-%H%M%S")
    );

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if let Ok(val) = HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename)) {
        headers.insert(header::CONTENT_DISPOSITION, val);
    }

    Ok((headers, Json(export_data)))
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportPayload {
    #[serde(default)]
    pub version: Option<u32>,
    #[serde(default)]
    pub monitors: Option<Vec<ExportMonitorItem>>,
    #[serde(default)]
    pub notification_channels: Option<Vec<ExportChannelItem>>,
    #[serde(default)]
    pub channels: Option<Vec<ExportChannelItem>>,
    /// Conflict resolution strategy: "skip" (default), "overwrite", "create_copy"
    #[serde(default)]
    pub conflict_strategy: Option<String>,
    #[serde(default = "default_true")]
    pub import_monitors: bool,
    #[serde(default = "default_true")]
    pub import_channels: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportSummary {
    pub monitors_imported: usize,
    pub monitors_updated: usize,
    pub monitors_skipped: usize,
    pub channels_imported: usize,
    pub channels_updated: usize,
    pub channels_skipped: usize,
    pub errors: Vec<String>,
}

/// POST /api/config/import
/// Imports monitors and alert notification channels into the authenticated team.
pub async fn import_config(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<ImportPayload>,
) -> Result<Json<ImportSummary>, (StatusCode, String)> {
    if !auth.role.can_mutate_monitors() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to import configuration", auth.role.as_str()),
        ));
    }

    let strategy = payload
        .conflict_strategy
        .as_deref()
        .unwrap_or("skip")
        .to_lowercase();

    let team_plan: String = sqlx::query_scalar("SELECT plan FROM teams WHERE id = $1")
        .bind(auth.user.team_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap_or_else(|| "FREE".to_string());

    let plan_limits = plans::limits(&team_plan);

    let (mut current_monitor_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*)::bigint FROM monitors WHERE team_id = $1")
            .bind(auth.user.team_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut summary = ImportSummary {
        monitors_imported: 0,
        monitors_updated: 0,
        monitors_skipped: 0,
        channels_imported: 0,
        channels_updated: 0,
        channels_skipped: 0,
        errors: Vec::new(),
    };

    // 1. Import Monitors
    if payload.import_monitors {
        if let Some(monitors_to_import) = payload.monitors {
            for mut item in monitors_to_import {
                // Validate target security policy (SSRF guard)
                if let Err((_, err_msg)) = validate_monitor_target(&item.monitor_type, &item.url).await {
                    summary.errors.push(format!("Monitor '{}': {}", item.name, err_msg));
                    continue;
                }

                if team_plan != "PRO"
                    && item.cron_expression.as_deref().map_or(false, |c| !c.trim().is_empty())
                {
                    summary.errors.push(format!(
                        "Monitor '{}': custom Cron schedules are a Pro feature.{}",
                        item.name,
                        state.settings.upgrade_hint()
                    ));
                    summary.monitors_skipped += 1;
                    continue;
                }

                // Check min interval for plan
                let min_interval = plan_limits.min_interval_seconds;
                if item.interval_seconds < min_interval {
                    item.interval_seconds = min_interval;
                }

                // Check if existing monitor in team with same name
                let existing_id: Option<Uuid> = sqlx::query_scalar(
                    "SELECT id FROM monitors WHERE team_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))"
                )
                .bind(auth.user.team_id)
                .bind(&item.name)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                if let Some(id) = existing_id {
                    match strategy.as_str() {
                        "overwrite" => {
                            let headers_json = if item.headers.is_null() {
                                serde_json::json!({})
                            } else {
                                item.headers
                            };

                            let update_res = sqlx::query(
                                r#"
                                UPDATE monitors SET
                                    url = $1, monitor_type = $2, interval_seconds = $3,
                                    timeout_seconds = $4, method = $5, headers = $6, body = $7,
                                    expected_status_code = $8, keyword = $9, port = $10,
                                    auth_username = $11, auth_password = COALESCE($12, auth_password),
                                    tags = $13, group_name = $14, grace_seconds = $15,
                                    is_paused = $16, updated_at = NOW()
                                WHERE id = $17 AND team_id = $18
                                "#
                            )
                            .bind(&item.url)
                            .bind(item.monitor_type.to_uppercase())
                            .bind(item.interval_seconds)
                            .bind(item.timeout_seconds)
                            .bind(item.method.to_uppercase())
                            .bind(headers_json)
                            .bind(&item.body)
                            .bind(item.expected_status_code)
                            .bind(&item.keyword)
                            .bind(item.port)
                            .bind(&item.auth_username)
                            .bind(&item.auth_password)
                            .bind(&item.tags)
                            .bind(&item.group_name)
                            .bind(item.grace_seconds)
                            .bind(item.is_paused)
                            .bind(id)
                            .bind(auth.user.team_id)
                            .execute(&state.pool)
                            .await;

                            match update_res {
                                Ok(_) => summary.monitors_updated += 1,
                                Err(e) => summary.errors.push(format!("Failed to update '{}': {}", item.name, e)),
                            }
                        }
                        "create_copy" => {
                            if current_monitor_count >= plan_limits.max_monitors {
                                summary.errors.push(format!(
                                    "Monitor limit reached ({} max on {} plan), skipping copy for '{}'",
                                    plan_limits.max_monitors, team_plan, item.name
                                ));
                                summary.monitors_skipped += 1;
                                continue;
                            }

                            item.name = format!("{} (copy)", item.name);
                            if let Ok(inserted) = insert_new_monitor(&auth, &state, &item).await {
                                current_monitor_count += 1;
                                summary.monitors_imported += 1;
                                if inserted.monitor_type.to_uppercase() != "HEARTBEAT" && !inserted.is_paused {
                                    let pool = state.pool.clone();
                                    let client = state.http_client.clone();
                                    let tx = state.tx.clone();
                                    tokio::spawn(async move {
                                        execute_single_probe(pool, client, inserted, tx).await;
                                    });
                                }
                            } else {
                                summary.errors.push(format!("Failed to create copy of '{}'", item.name));
                            }
                        }
                        _ => {
                            // "skip"
                            summary.monitors_skipped += 1;
                        }
                    }
                } else {
                    // New monitor: check plan limit
                    if current_monitor_count >= plan_limits.max_monitors {
                        summary.errors.push(format!(
                            "Monitor limit reached ({} max on {} plan), skipping '{}'",
                            plan_limits.max_monitors, team_plan, item.name
                        ));
                        summary.monitors_skipped += 1;
                        continue;
                    }

                    match insert_new_monitor(&auth, &state, &item).await {
                        Ok(inserted) => {
                            current_monitor_count += 1;
                            summary.monitors_imported += 1;
                            if inserted.monitor_type.to_uppercase() != "HEARTBEAT" && !inserted.is_paused {
                                let pool = state.pool.clone();
                                let client = state.http_client.clone();
                                let tx = state.tx.clone();
                                tokio::spawn(async move {
                                    execute_single_probe(pool, client, inserted, tx).await;
                                });
                            }
                        }
                        Err(err_msg) => {
                            summary.errors.push(format!("Failed to insert '{}': {}", item.name, err_msg));
                        }
                    }
                }
            }
        }
    }

    // 2. Import Notification Channels
    if payload.import_channels {
        let channels_to_import = payload.notification_channels.or(payload.channels);
        if let Some(channels) = channels_to_import {
            for mut item in channels {
                if let Err((_, err_msg)) = validate_channel_config(&item.config).await {
                    summary.errors.push(format!("Channel '{}': {}", item.name, err_msg));
                    continue;
                }

                if team_plan != "PRO" && !item.filter_tags.is_empty() {
                    summary.errors.push(format!(
                        "Channel '{}': tag-based alert routing is a Pro feature.{}",
                        item.name,
                        state.settings.upgrade_hint()
                    ));
                    summary.channels_skipped += 1;
                    continue;
                }

                // Check existing channel by name in team
                let existing_id: Option<Uuid> = sqlx::query_scalar(
                    "SELECT id FROM notification_channels WHERE team_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))"
                )
                .bind(auth.user.team_id)
                .bind(&item.name)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                if let Some(id) = existing_id {
                    match strategy.as_str() {
                        "overwrite" => {
                            let mut merged_config = item.config.clone();
                            if let Some(merged_obj) = merged_config.as_object_mut() {
                                let existing_cfg_val: Option<serde_json::Value> = sqlx::query_scalar(
                                    "SELECT config FROM notification_channels WHERE id = $1"
                                )
                                .bind(id)
                                .fetch_optional(&state.pool)
                                .await
                                .unwrap_or(None);

                                if let Some(existing_cfg) = existing_cfg_val.and_then(|v| v.as_object().cloned()) {
                                    if let Some(tok) = merged_obj.get("bot_token") {
                                        if tok == "********" {
                                            if let Some(old_tok) = existing_cfg.get("bot_token") {
                                                merged_obj.insert("bot_token".to_string(), old_tok.clone());
                                            }
                                        }
                                    }
                                    if let Some(url) = merged_obj.get("webhook_url") {
                                        if url.as_str().map(|s| s.ends_with("...")).unwrap_or(false) {
                                            if let Some(old_url) = existing_cfg.get("webhook_url") {
                                                merged_obj.insert("webhook_url".to_string(), old_url.clone());
                                            }
                                        }
                                    }
                                }
                            }

                            let update_res = sqlx::query(
                                r#"
                                UPDATE notification_channels SET
                                    channel_type = $1, config = $2, is_active = $3,
                                    filter_tags = $4
                                WHERE id = $5 AND team_id = $6
                                "#
                            )
                            .bind(item.channel_type.to_uppercase())
                            .bind(merged_config)
                            .bind(item.is_active)
                            .bind(&item.filter_tags)
                            .bind(id)
                            .bind(auth.user.team_id)
                            .execute(&state.pool)
                            .await;

                            match update_res {
                                Ok(_) => summary.channels_updated += 1,
                                Err(e) => summary.errors.push(format!("Failed to update channel '{}': {}", item.name, e)),
                            }
                        }
                        "create_copy" => {
                            item.name = format!("{} (copy)", item.name);
                            let is_masked = item.config.get("bot_token").map(|v| v == "********").unwrap_or(false)
                                || item.config.get("webhook_url").and_then(|v| v.as_str()).map(|s| s.ends_with("...")).unwrap_or(false);
                            if is_masked {
                                summary.errors.push(format!(
                                    "Channel '{}': imported from sanitized export with placeholder secrets. Please edit channel to set real credentials.",
                                    item.name
                                ));
                            }
                            if let Ok(_) = insert_new_channel(&auth, &state, &item).await {
                                summary.channels_imported += 1;
                            } else {
                                summary.errors.push(format!("Failed to create copy of channel '{}'", item.name));
                            }
                        }
                        _ => {
                            // "skip"
                            summary.channels_skipped += 1;
                        }
                    }
                } else {
                    let is_masked = item.config.get("bot_token").map(|v| v == "********").unwrap_or(false)
                        || item.config.get("webhook_url").and_then(|v| v.as_str()).map(|s| s.ends_with("...")).unwrap_or(false);
                    if is_masked {
                        summary.errors.push(format!(
                            "Channel '{}': imported from sanitized export with placeholder secrets. Please edit channel to set real credentials.",
                            item.name
                        ));
                    }
                    match insert_new_channel(&auth, &state, &item).await {
                        Ok(_) => summary.channels_imported += 1,
                        Err(err_msg) => summary.errors.push(format!("Failed to insert channel '{}': {}", item.name, err_msg)),
                    }
                }
            }
        }
    }

    Ok(Json(summary))
}

async fn insert_new_monitor(
    auth: &AuthUser,
    state: &AppState,
    item: &ExportMonitorItem,
) -> Result<Monitor, String> {
    let headers_json = if item.headers.is_null() {
        serde_json::json!({})
    } else {
        item.headers.clone()
    };

    let heartbeat_token = if item.monitor_type.to_uppercase() == "HEARTBEAT" {
        Some(Uuid::new_v4().to_string().replace('-', ""))
    } else {
        None
    };

    let next_expected_at = if let Some(ref cron_str) = item.cron_expression {
        if let Ok(cron) = std::str::FromStr::from_str(cron_str) {
            let tz: chrono_tz::Tz = item.timezone.parse().unwrap_or(chrono_tz::UTC);
            let now_tz = Utc::now().with_timezone(&tz);
            let c: croner::Cron = cron;
            c.find_next_occurrence(&now_tz, false).ok().map(|dt| dt.with_timezone(&Utc))
        } else {
            None
        }
    } else {
        None
    };

    sqlx::query_as::<_, Monitor>(
        r#"
        INSERT INTO monitors (
            team_id, name, url, monitor_type, interval_seconds, timeout_seconds,
            method, headers, body, expected_status_code, keyword, port, heartbeat_token,
            auth_username, auth_password, tags, group_name, grace_seconds,
            slug, cron_expression, timezone, next_expected_at, is_paused
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *
        "#
    )
    .bind(auth.user.team_id)
    .bind(&item.name)
    .bind(&item.url)
    .bind(item.monitor_type.to_uppercase())
    .bind(item.interval_seconds)
    .bind(item.timeout_seconds)
    .bind(item.method.to_uppercase())
    .bind(headers_json)
    .bind(&item.body)
    .bind(item.expected_status_code)
    .bind(&item.keyword)
    .bind(item.port)
    .bind(heartbeat_token)
    .bind(&item.auth_username)
    .bind(&item.auth_password)
    .bind(&item.tags)
    .bind(&item.group_name)
    .bind(item.grace_seconds)
    .bind(&item.slug)
    .bind(&item.cron_expression)
    .bind(&item.timezone)
    .bind(next_expected_at)
    .bind(item.is_paused)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())
}

async fn insert_new_channel(
    auth: &AuthUser,
    state: &AppState,
    item: &ExportChannelItem,
) -> Result<NotificationChannel, String> {
    sqlx::query_as::<_, NotificationChannel>(
        r#"
        INSERT INTO notification_channels (team_id, name, channel_type, config, is_active, filter_tags)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#
    )
    .bind(auth.user.team_id)
    .bind(item.name.trim())
    .bind(item.channel_type.to_uppercase().trim())
    .bind(&item.config)
    .bind(item.is_active)
    .bind(&item.filter_tags)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())
}
