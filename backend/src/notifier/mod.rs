pub mod discord;
pub mod slack;
pub mod telegram;
pub mod webhook;

use crate::db::DbPool;
use crate::models::{Monitor, NotificationChannel, WsMessage};
use chrono::Utc;
use reqwest::Client;
use serde_json::json;
use tokio::sync::broadcast::Sender;
use tracing::{error, info};
use uuid::Uuid;

#[derive(Clone)]
pub enum AlertEvent {
    Down {
        error: String,
        incident_id: Option<Uuid>,
    },
    Resolved {
        duration_seconds: i32,
        incident_id: Option<Uuid>,
    },
    Test,
}

pub async fn dispatch_alert(
    pool: &DbPool,
    client: &Client,
    monitor: &Monitor,
    event: AlertEvent,
    tx: Option<&Sender<WsMessage>>,
) {
    let channels: Vec<NotificationChannel> = match sqlx::query_as::<_, NotificationChannel>(
        "SELECT * FROM notification_channels WHERE is_active = TRUE"
    )
    .fetch_all(pool)
    .await
    {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to fetch notification channels: {}", e);
            return;
        }
    };

    if channels.is_empty() {
        return;
    }

    for ch in channels {
        let pool = pool.clone();
        let client = client.clone();
        let m = monitor.clone();
        let tx = tx.cloned();
        let ev = event.clone();

        tokio::spawn(async move {
            let (event_name, incident_id, err_str, duration_secs) = match &ev {
                AlertEvent::Down { error, incident_id } => ("DOWN", *incident_id, Some(error.as_str()), None),
                AlertEvent::Resolved { duration_seconds, incident_id } => ("RESOLVED", *incident_id, None, Some(*duration_seconds)),
                AlertEvent::Test => ("TEST", None, None, None),
            };

            let res = deliver_to_channel(&client, &ch, &m, event_name, err_str, duration_secs).await;
            let (status, err_msg) = match res {
                Ok(_) => ("SUCCESS", None),
                Err(ref e) => ("FAILED", Some(e.clone())),
            };

            info!(
                "Alert dispatch to channel '{}' ({}): status={}",
                ch.name, ch.channel_type, status
            );

            // Log to alert_logs table
            let _ = sqlx::query(
                r#"
                INSERT INTO alert_logs (
                    channel_id, incident_id, monitor_id, event_type, status, error_message, sent_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                "#
            )
            .bind(ch.id)
            .bind(incident_id)
            .bind(m.id)
            .bind(event_name)
            .bind(status)
            .bind(&err_msg)
            .execute(&pool)
            .await;

            if let Some(ref sender) = tx {
                let _ = sender.send(WsMessage::AlertDispatched {
                    channel_name: ch.name.clone(),
                    status: status.to_string(),
                    event_type: event_name.to_string(),
                });
            }
        });
    }
}

pub async fn deliver_to_channel(
    client: &Client,
    ch: &NotificationChannel,
    monitor: &Monitor,
    event_name: &str,
    error_detail: Option<&str>,
    duration_secs: Option<i32>,
) -> Result<(), String> {
    let title = match event_name {
        "DOWN" => format!("🚨 INCIDENT: {} is DOWN", monitor.name),
        "RESOLVED" => format!("✅ RESOLVED: {} is UP", monitor.name),
        _ => format!("🔔 ResPulse Test Notification: {}", monitor.name),
    };

    let text_detail = match event_name {
        "DOWN" => format!(
            "Target: {}\nError: {}\nTime: {}",
            monitor.url,
            error_detail.unwrap_or("Service unavailable"),
            Utc::now().to_rfc3339()
        ),
        "RESOLVED" => format!(
            "Target: {}\nDowntime: {} seconds\nTime: {}",
            monitor.url,
            duration_secs.unwrap_or(0),
            Utc::now().to_rfc3339()
        ),
        _ => format!("Target: {}\nResPulse test ping successful.", monitor.url),
    };

    match ch.channel_type.to_uppercase().as_str() {
        "TELEGRAM" => {
            telegram::send_telegram(client, &ch.config, &title, &text_detail).await
        }
        "DISCORD" => {
            let is_down = event_name == "DOWN";
            let mut fields = vec![("Target", monitor.url.as_str())];
            let err_val;
            let dur_val;
            if is_down {
                err_val = error_detail.unwrap_or("Service unavailable");
                fields.push(("Error", err_val));
            } else if let Some(d) = duration_secs {
                dur_val = format!("{} seconds", d);
                fields.push(("Downtime Duration", &dur_val));
            }
            discord::send_discord(client, &ch.config, &title, &text_detail, is_down, fields).await
        }
        "SLACK" => {
            let is_down = event_name == "DOWN";
            slack::send_slack(client, &ch.config, &title, &text_detail, is_down).await
        }
        "WEBHOOK" | "CUSTOM" | _ => {
            let payload = json!({
                "event": event_name,
                "monitor": {
                    "id": monitor.id,
                    "name": monitor.name,
                    "url": monitor.url,
                    "type": monitor.monitor_type
                },
                "incident": {
                    "error": error_detail,
                    "duration_seconds": duration_secs
                },
                "timestamp": Utc::now()
            });
            webhook::send_generic_webhook(client, &ch.config, &payload).await
        }
    }
}

pub async fn test_channel(client: &Client, channel: &NotificationChannel) -> Result<(), String> {
    let dummy_monitor = Monitor {
        id: Uuid::new_v4(),
        name: "Test System Service".to_string(),
        url: "https://respulse.wsl.local".to_string(),
        monitor_type: "HTTP".to_string(),
        interval_seconds: 60,
        timeout_seconds: 10,
        method: "GET".to_string(),
        headers: json!({}),
        body: None,
        expected_status_code: Some(200),
        keyword: None,
        port: None,
        status: "UP".to_string(),
        is_paused: false,
        last_checked_at: Some(Utc::now()),
        last_status_change_at: None,
        last_response_time_ms: Some(25.4),
        last_status_code: Some(200),
        last_error: None,
        heartbeat_token: None,
        auth_username: None,
        auth_password: None,
        tags: vec![],
        group_name: "Default".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    deliver_to_channel(client, channel, &dummy_monitor, "TEST", None, None).await
}
