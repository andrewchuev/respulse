use crate::db::DbPool;
use crate::models::{Incident, Monitor, WsMessage};
use crate::probe::http::{check_http, ProbeResult};
use crate::probe::ssl::check_ssl;
use crate::probe::tcp::check_tcp;
use chrono::Utc;
use reqwest::Client;
use std::collections::HashSet;
use std::str::FromStr;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tokio::sync::broadcast::Sender;
use tracing::{error, info};
use uuid::Uuid;

pub async fn run_probe_scheduler(pool: DbPool, tx: Sender<WsMessage>) {
    let user_agent = std::env::var("APP_USER_AGENT")
        .unwrap_or_else(|_| "ResPulse/1.0 (+https://respulse.online)".to_string());

    let client = Arc::new(crate::net_guard::policy().build_client(user_agent));

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
              (
                  monitor_type = 'HEARTBEAT' AND status != 'DOWN' AND (
                      (
                          cron_expression IS NOT NULL
                          AND next_expected_at IS NOT NULL
                          AND next_expected_at + (grace_seconds * INTERVAL '1 second') <= NOW()
                      )
                      OR (
                          cron_expression IS NULL
                          AND COALESCE(last_checked_at, created_at) + ((interval_seconds + grace_seconds) * INTERVAL '1 second') <= NOW()
                      )
                      OR (
                          last_start_at IS NOT NULL
                          AND last_start_at > COALESCE(last_checked_at, '1970-01-01'::timestamptz)
                          AND last_start_at + (timeout_seconds * INTERVAL '1 second') <= NOW()
                      )
                  )
              )
              OR (
                  monitor_type != 'HEARTBEAT' AND (
                      last_checked_at IS NULL
                      OR last_checked_at + (interval_seconds * INTERVAL '1 second') <= NOW()
                  )
              )
          )
        LIMIT 50
        "#,
    )
    .fetch_all(&pool)
    .await?;

    for monitor in monitors {
        // last_checked_at is only written when a probe finishes, so a slow probe would otherwise be
        // re-dispatched on every tick, flooding the target and duplicating incidents and alerts.
        let Some(guard) = InFlightGuard::acquire(monitor.id) else {
            continue;
        };
        let pool = pool.clone();
        let client = client.clone();
        let tx = tx.clone();

        tokio::spawn(async move {
            let _guard = guard;
            execute_single_probe(pool, client, monitor, tx).await;
        });
    }

    Ok(())
}

static IN_FLIGHT: LazyLock<Mutex<HashSet<Uuid>>> = LazyLock::new(Default::default);

/// Marks a monitor as being probed; released on drop, including when the probe task panics.
struct InFlightGuard(Uuid);

impl InFlightGuard {
    fn acquire(id: Uuid) -> Option<Self> {
        // Built lazily: an eagerly created guard that is discarded would run Drop and release the id.
        let inserted = IN_FLIGHT.lock().unwrap_or_else(|e| e.into_inner()).insert(id);
        inserted.then(|| Self(id))
    }
}

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        IN_FLIGHT.lock().unwrap_or_else(|e| e.into_inner()).remove(&self.0);
    }
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
            // Heartbeat monitors only transition from DOWN to UP via incoming ping signals.
            if monitor.status == "DOWN" {
                return;
            }

            let now = Utc::now();
            let is_hung = if let Some(started_at) = monitor.last_start_at {
                let is_after_checked = monitor.last_checked_at.map_or(true, |c| started_at > c);
                if is_after_checked {
                    let running_secs = (now - started_at).num_seconds();
                    let max_run_secs = if monitor.timeout_seconds > 0 {
                        monitor.timeout_seconds as i64
                    } else if monitor.grace_seconds > 0 {
                        monitor.grace_seconds as i64
                    } else {
                        monitor.interval_seconds as i64
                    };
                    running_secs > max_run_secs
                } else {
                    false
                }
            } else {
                false
            };

            let overdue_msg = if is_hung {
                let dur = (now - monitor.last_start_at.unwrap()).num_seconds();
                Some(format!("Job execution exceeded time limit (hung/stuck after {}s)", dur))
            } else if let Some(ref cron_expr) = monitor.cron_expression {
                let tz: chrono_tz::Tz = monitor.timezone.parse().unwrap_or(chrono_tz::UTC);
                if let Ok(cron) = croner::Cron::from_str(cron_expr) {
                    let last_ts = monitor.last_checked_at.unwrap_or(monitor.created_at);
                    let last_ts_tz = last_ts.with_timezone(&tz);
                    let now_tz = now.with_timezone(&tz);
                    if let Ok(next_run) = cron.find_next_occurrence(&last_ts_tz, false) {
                        let deadline = next_run + chrono::Duration::seconds(monitor.grace_seconds as i64);
                        if now_tz > deadline {
                            Some(format!("Missed scheduled cron ping (cron: '{}', expected: {}, grace: {}s)", cron_expr, next_run.format("%Y-%m-%d %H:%M:%S"), monitor.grace_seconds))
                        } else {
                            return; // Not overdue yet
                        }
                    } else {
                        let diff_secs = (now - last_ts).num_seconds();
                        let allowed_secs = (monitor.interval_seconds as i64) + (monitor.grace_seconds as i64);
                        if diff_secs > allowed_secs {
                            Some("Missed expected heartbeat ping".to_string())
                        } else {
                            return; // Not overdue yet
                        }
                    }
                } else {
                    Some("Invalid cron expression configured".to_string())
                }
            } else {
                let last_ts = monitor.last_checked_at.unwrap_or(monitor.created_at);
                let diff_secs = (now - last_ts).num_seconds();
                let allowed_secs = (monitor.interval_seconds as i64) + (monitor.grace_seconds as i64);
                if diff_secs > allowed_secs {
                    Some(format!("Missed expected heartbeat ping (interval: {}s, grace: {}s)", monitor.interval_seconds, monitor.grace_seconds))
                } else {
                    return; // Not overdue yet
                }
            };

            ProbeResult {
                is_up: false,
                status_code: None,
                response_time_ms: monitor.last_duration_ms.unwrap_or(1.0),
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: overdue_msg,
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
                INSERT INTO incidents (id, team_id, monitor_id, status, started_at, root_cause, title, severity, stage, summary)
                VALUES ($1, $2, $3, 'ONGOING', NOW(), $4, $5, 'MAJOR', 'INVESTIGATING', $6)
                "#
            )
            .bind(incident_id)
            .bind(monitor.team_id)
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
                team_id: monitor.team_id,
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
        team_id: monitor.team_id,
        monitor_id: monitor.id,
        is_up: probe_result.is_up,
        response_time_ms: probe_result.response_time_ms,
        status_code: probe_result.status_code,
        error: probe_result.error,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_flight_guard_blocks_duplicates_until_dropped() {
        let id = Uuid::new_v4();
        let first = InFlightGuard::acquire(id).expect("first acquire succeeds");
        assert!(InFlightGuard::acquire(id).is_none());
        drop(first);
        assert!(InFlightGuard::acquire(id).is_some());
    }
}
