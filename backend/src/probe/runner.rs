use crate::db::DbPool;
use crate::models::{Incident, Monitor, WsMessage};
use crate::probe::http::{check_http, ProbeResult};
use crate::probe::ssl::check_ssl;
use crate::probe::tcp::check_tcp;
use chrono::Utc;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast::Sender;
use tracing::{error, info};
use uuid::Uuid;

pub async fn run_probe_scheduler(pool: DbPool, tx: Sender<WsMessage>) {
    let user_agent = std::env::var("APP_USER_AGENT")
        .unwrap_or_else(|_| "ResPulse/1.0 (+https://respulse.online)".to_string());

    let client = Client::builder()
        .user_agent(user_agent)
        .danger_accept_invalid_certs(true)
        .build()
        .expect("Failed to build reqwest client");

    let client = Arc::new(client);

    info!("Starting probe scheduler loop...");

    loop {
        let pool_clone = pool.clone();
        let client_clone = client.clone();
        let tx_clone = tx.clone();

        tokio::spawn(async move {
            if let Err(e) = check_due_monitors(pool_clone, client_clone, tx_clone).await {
                error!("Error checking due monitors: {:?}", e);
            }
        });

        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

async fn check_due_monitors(
    pool: DbPool,
    client: Arc<Client>,
    tx: Sender<WsMessage>,
) -> Result<(), sqlx::Error> {
    let monitors: Vec<Monitor> = sqlx::query_as::<_, Monitor>(
        r#"
        SELECT * FROM monitors
        WHERE is_paused = FALSE
          AND (
              last_checked_at IS NULL
              OR last_checked_at + (interval_seconds * INTERVAL '1 second') <= NOW()
          )
        LIMIT 50
        "#,
    )
    .fetch_all(&pool)
    .await?;

    for monitor in monitors {
        let pool = pool.clone();
        let client = client.clone();
        let tx = tx.clone();

        tokio::spawn(async move {
            execute_single_probe(pool, client, monitor, tx).await;
        });
    }

    Ok(())
}

pub async fn execute_single_probe(
    pool: DbPool,
    client: Arc<Client>,
    monitor: Monitor,
    tx: Sender<WsMessage>,
) {
    let prev_status = monitor.status.clone();

    let probe_result = match monitor.monitor_type.to_uppercase().as_str() {
        "PORT" | "TCP" => check_tcp(&monitor).await,
        "SSL" => check_ssl(&monitor).await,
        "HEARTBEAT" => {
            let is_up = if let Some(last_checked) = monitor.last_checked_at {
                let diff_secs = (Utc::now() - last_checked).num_seconds();
                diff_secs <= (monitor.interval_seconds as i64 * 2)
            } else {
                false
            };
            ProbeResult {
                is_up,
                status_code: None,
                response_time_ms: 1.0,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: if is_up { None } else { Some("Missed expected heartbeat ping".to_string()) },
            }
        }
        _ => check_http(&client, &monitor).await,
    };

    let new_status = if probe_result.is_up { "UP" } else { "DOWN" };
    let status_changed = prev_status != new_status;

    // Record check result
    let _ = sqlx::query(
        r#"
        INSERT INTO check_results (
            monitor_id, is_up, status_code, response_time_ms, dns_time_ms,
            connect_time_ms, tls_time_ms, error, checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        "#
    )
    .bind(monitor.id)
    .bind(probe_result.is_up)
    .bind(probe_result.status_code)
    .bind(probe_result.response_time_ms)
    .bind(probe_result.dns_time_ms)
    .bind(probe_result.connect_time_ms)
    .bind(probe_result.tls_time_ms)
    .bind(&probe_result.error)
    .execute(&pool)
    .await;

    // Handle incident creation or resolution
    if status_changed {
        if new_status == "DOWN" {
            let incident_id = Uuid::new_v4();
            let title = format!("{} Service Disruption", monitor.name);
            let summary = format!(
                "Our automated probes detected connectivity or response issues with {}.",
                monitor.name
            );
            let initial_update = format!(
                "Automated check failed: {}",
                probe_result.error.as_deref().unwrap_or("Endpoint check failed")
            );

            let _ = sqlx::query(
                r#"
                INSERT INTO incidents (id, monitor_id, status, started_at, root_cause, title, severity, stage, summary)
                VALUES ($1, $2, 'ONGOING', NOW(), $3, $4, 'MAJOR', 'INVESTIGATING', $5)
                "#
            )
            .bind(incident_id)
            .bind(monitor.id)
            .bind(&probe_result.error)
            .bind(&title)
            .bind(&summary)
            .execute(&pool)
            .await;

            let _ = sqlx::query(
                r#"
                INSERT INTO incident_updates (incident_id, stage, message, author)
                VALUES ($1, 'INVESTIGATING', $2, 'Automated Monitor')
                "#
            )
            .bind(incident_id)
            .bind(&initial_update)
            .execute(&pool)
            .await;

            let inc = Incident {
                id: incident_id,
                monitor_id: monitor.id,
                status: "ONGOING".to_string(),
                started_at: Utc::now(),
                resolved_at: None,
                duration_seconds: None,
                root_cause: probe_result.error.clone(),
                title: Some(title),
                severity: "MAJOR".to_string(),
                stage: "INVESTIGATING".to_string(),
                summary: Some(summary),
                post_mortem: None,
                is_published: true,
            };
            let _ = tx.send(WsMessage::IncidentCreated(inc));

            // Dispatch alert to configured channels (Telegram, Discord, Slack, Webhook)
            let err_msg = probe_result.error.as_deref().unwrap_or("Endpoint check failed").to_string();
            crate::notifier::dispatch_alert(
                &pool,
                &client,
                &monitor,
                crate::notifier::AlertEvent::Down {
                    error: err_msg,
                    incident_id: Some(incident_id),
                },
                Some(&tx),
            )
            .await;
        } else if new_status == "UP" && prev_status == "DOWN" {
            if let Ok(Some(inc)) = sqlx::query_as::<_, Incident>(
                r#"
                SELECT * FROM incidents
                WHERE monitor_id = $1 AND status = 'ONGOING'
                ORDER BY started_at DESC
                LIMIT 1
                "#
            )
            .bind(monitor.id)
            .fetch_optional(&pool)
            .await
            {
                let now = Utc::now();
                let duration = (now - inc.started_at).num_seconds() as i32;
                let _ = sqlx::query(
                    r#"
                    UPDATE incidents
                    SET status = 'RESOLVED', stage = 'RESOLVED', resolved_at = $1, duration_seconds = $2
                    WHERE id = $3
                    "#
                )
                .bind(now)
                .bind(duration)
                .bind(inc.id)
                .execute(&pool)
                .await;

                let recovery_msg = format!("Service recovered and is responding normally. Total outage duration: {}s.", duration);
                let _ = sqlx::query(
                    r#"
                    INSERT INTO incident_updates (incident_id, stage, message, author)
                    VALUES ($1, 'RESOLVED', $2, 'Automated Monitor')
                    "#
                )
                .bind(inc.id)
                .bind(&recovery_msg)
                .execute(&pool)
                .await;

                let mut resolved = inc.clone();
                resolved.status = "RESOLVED".to_string();
                resolved.stage = "RESOLVED".to_string();
                resolved.resolved_at = Some(now);
                resolved.duration_seconds = Some(duration);
                let _ = tx.send(WsMessage::IncidentResolved(resolved));

                // Dispatch recovery alert to configured channels
                crate::notifier::dispatch_alert(
                    &pool,
                    &client,
                    &monitor,
                    crate::notifier::AlertEvent::Resolved {
                        duration_seconds: duration,
                        incident_id: Some(inc.id),
                    },
                    Some(&tx),
                )
                .await;
            }
        }
    }

    // Update monitor table
    let updated = sqlx::query_as::<_, Monitor>(
        r#"
        UPDATE monitors
        SET status = $1,
            last_checked_at = NOW(),
            last_status_change_at = CASE WHEN $2 THEN NOW() ELSE last_status_change_at END,
            last_response_time_ms = $3,
            last_status_code = $4,
            last_error = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
        "#
    )
    .bind(new_status)
    .bind(status_changed)
    .bind(probe_result.response_time_ms)
    .bind(probe_result.status_code)
    .bind(&probe_result.error)
    .bind(monitor.id)
    .fetch_optional(&pool)
    .await;

    if let Ok(Some(updated_monitor)) = updated {
        let _ = tx.send(WsMessage::MonitorUpdated(updated_monitor));
    }

    let _ = tx.send(WsMessage::CheckCompleted {
        monitor_id: monitor.id,
        is_up: probe_result.is_up,
        response_time_ms: probe_result.response_time_ms,
        status_code: probe_result.status_code,
        error: probe_result.error,
    });
}
