use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{AlertLogWithDetails, CreateChannelRequest, NotificationChannel};
use crate::notifier;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Serialize)]
pub struct ChannelWithStats {
    #[serde(flatten)]
    pub channel: NotificationChannel,
    pub total_alerts_24h: i64,
    pub last_alert_at: Option<DateTime<Utc>>,
    pub last_status: Option<String>,
}

#[derive(FromRow)]
struct ChannelStatsRow {
    pub total_alerts: i64,
    pub last_alert: Option<DateTime<Utc>>,
    pub last_status: Option<String>,
}

pub async fn list_channels(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<ChannelWithStats>>, (StatusCode, String)> {
    let channels: Vec<NotificationChannel> = sqlx::query_as::<_, NotificationChannel>(
        "SELECT * FROM notification_channels WHERE team_id = $1 ORDER BY created_at DESC"
    )
    .bind(auth.user.team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result = Vec::new();
    let day_ago = Utc::now() - chrono::Duration::days(1);

    for ch in channels {
        let stats: ChannelStatsRow = sqlx::query_as(
            r#"
            SELECT
                COUNT(*)::bigint as total_alerts,
                MAX(sent_at) as last_alert,
                (SELECT status FROM alert_logs WHERE channel_id = $1 ORDER BY sent_at DESC LIMIT 1) as last_status
            FROM alert_logs
            WHERE channel_id = $1 AND sent_at >= $2
            "#
        )
        .bind(ch.id)
        .bind(day_ago)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(ChannelStatsRow {
            total_alerts: 0,
            last_alert: None,
            last_status: None,
        });

        result.push(ChannelWithStats {
            channel: ch,
            total_alerts_24h: stats.total_alerts,
            last_alert_at: stats.last_alert,
            last_status: stats.last_status,
        });
    }

    Ok(Json(result))
}

pub async fn create_channel(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<Json<NotificationChannel>, (StatusCode, String)> {
    if !auth.role.can_manage_channels() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to create channels", auth.role.as_str()),
        ));
    }

    let channel = sqlx::query_as::<_, NotificationChannel>(
        r#"
        INSERT INTO notification_channels (team_id, name, channel_type, config, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#
    )
    .bind(auth.user.team_id)
    .bind(payload.name.trim())
    .bind(payload.channel_type.to_uppercase().trim())
    .bind(payload.config)
    .bind(payload.is_active)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(channel))
}

#[derive(Deserialize)]
pub struct UpdateChannelRequest {
    pub name: Option<String>,
    pub channel_type: Option<String>,
    pub config: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

pub async fn update_channel(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateChannelRequest>,
) -> Result<Json<NotificationChannel>, (StatusCode, String)> {
    if !auth.role.can_manage_channels() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to update channels", auth.role.as_str()),
        ));
    }

    let existing: NotificationChannel = sqlx::query_as::<_, NotificationChannel>(
        "SELECT * FROM notification_channels WHERE id = $1 AND team_id = $2"
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Channel not found".to_string()))?;

    let name = payload.name.unwrap_or(existing.name);
    let channel_type = payload.channel_type.unwrap_or(existing.channel_type);
    let config = payload.config.unwrap_or(existing.config);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let updated = sqlx::query_as::<_, NotificationChannel>(
        r#"
        UPDATE notification_channels
        SET name = $1, channel_type = $2, config = $3, is_active = $4
        WHERE id = $5 AND team_id = $6
        RETURNING *
        "#
    )
    .bind(name)
    .bind(channel_type.to_uppercase())
    .bind(config)
    .bind(is_active)
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

pub async fn delete_channel(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if !auth.role.can_manage_channels() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to delete channels", auth.role.as_str()),
        ));
    }

    sqlx::query("DELETE FROM notification_channels WHERE id = $1 AND team_id = $2")
        .bind(id)
        .bind(auth.user.team_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct TestChannelResponse {
    pub success: bool,
    pub message: String,
    pub error: Option<String>,
}

pub async fn test_channel(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TestChannelResponse>, (StatusCode, String)> {
    if !auth.role.can_manage_channels() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to test alert channels", auth.role.as_str()),
        ));
    }

    let channel: NotificationChannel = sqlx::query_as::<_, NotificationChannel>(
        "SELECT * FROM notification_channels WHERE id = $1 AND team_id = $2"
    )
    .bind(id)
    .bind(auth.user.team_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Channel not found".to_string()))?;

    let res = notifier::test_channel(&state.http_client, &channel).await;
    let (success, status, err_msg) = match res {
        Ok(_) => (true, "SUCCESS", None),
        Err(e) => (false, "FAILED", Some(e)),
    };

    // Log the test alert
    let _ = sqlx::query(
        r#"
        INSERT INTO alert_logs (
            channel_id, incident_id, monitor_id, event_type, status, error_message, sent_at
        ) VALUES ($1, NULL, NULL, 'TEST', $2, $3, NOW())
        "#
    )
    .bind(channel.id)
    .bind(status)
    .bind(&err_msg)
    .execute(&state.pool)
    .await;

    Ok(Json(TestChannelResponse {
        success,
        message: if success {
            format!("Test alert sent successfully to '{}'", channel.name)
        } else {
            format!("Failed to send alert to '{}'", channel.name)
        },
        error: err_msg,
    }))
}

#[derive(FromRow)]
struct AlertLogRow {
    pub id: i64,
    pub channel_id: Uuid,
    pub channel_name: String,
    pub channel_type: String,
    pub monitor_id: Option<Uuid>,
    pub monitor_name: Option<String>,
    pub event_type: String,
    pub status: String,
    pub error_message: Option<String>,
    pub sent_at: DateTime<Utc>,
}

pub async fn list_alert_logs(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<AlertLogWithDetails>>, (StatusCode, String)> {
    let rows: Vec<AlertLogRow> = sqlx::query_as(
        r#"
        SELECT
            l.id,
            l.channel_id,
            c.name as channel_name,
            c.channel_type,
            l.monitor_id,
            m.name as monitor_name,
            l.event_type,
            l.status,
            l.error_message,
            l.sent_at
        FROM alert_logs l
        JOIN notification_channels c ON l.channel_id = c.id
        LEFT JOIN monitors m ON l.monitor_id = m.id
        WHERE c.team_id = $1
        ORDER BY l.sent_at DESC
        LIMIT 50
        "#
    )
    .bind(auth.user.team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let list = rows
        .into_iter()
        .map(|r| AlertLogWithDetails {
            id: r.id,
            channel_id: r.channel_id,
            channel_name: r.channel_name,
            channel_type: r.channel_type,
            monitor_id: r.monitor_id,
            monitor_name: r.monitor_name,
            event_type: r.event_type,
            status: r.status,
            error_message: r.error_message,
            sent_at: r.sent_at,
        })
        .collect();

    Ok(Json(list))
}
