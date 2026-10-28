//! Prunes old probe history so `check_results` cannot grow without bound.
//!
//! Free teams keep 14 days of history and Pro teams 90, matching the plan limits advertised in
//! the UI; both are overridable for self-hosted installs.

use crate::db::DbPool;
use std::time::Duration;
use tracing::{error, info};

const BATCH_SIZE: i64 = 5000;

fn days_from_env(name: &str, default: i32) -> i32 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<i32>().ok())
        .filter(|d| *d > 0)
        .unwrap_or(default)
}

pub async fn run_retention_loop(pool: DbPool) {
    let free_days = days_from_env("RETENTION_FREE_DAYS", crate::plans::FREE.retention_days);
    let pro_days = days_from_env("RETENTION_PRO_DAYS", crate::plans::PRO.retention_days);
    info!("Check history retention: {} days (Free), {} days (Pro)", free_days, pro_days);

    // Let startup settle before the first pass, then run daily.
    tokio::time::sleep(Duration::from_secs(60)).await;
    let mut tick = tokio::time::interval(Duration::from_secs(24 * 3600));
    loop {
        tick.tick().await;
        match prune(&pool, free_days, pro_days).await {
            Ok(0) => info!("Retention pass: nothing to delete"),
            Ok(deleted) => info!("Retention pass: deleted {} old check results", deleted),
            Err(e) => error!("Retention pass failed: {:?}", e),
        }
    }
}

/// Deletes in batches so a large backlog never holds a long lock on the table.
async fn prune(pool: &DbPool, free_days: i32, pro_days: i32) -> Result<u64, sqlx::Error> {
    let mut total = 0;
    loop {
        let deleted = sqlx::query(
            r#"
            DELETE FROM check_results WHERE id IN (
                SELECT c.id
                FROM check_results c
                JOIN monitors m ON m.id = c.monitor_id
                JOIN teams t ON t.id = m.team_id
                WHERE c.checked_at < NOW() - make_interval(days => CASE WHEN t.plan = 'PRO' THEN $1 ELSE $2 END)
                LIMIT $3
            )
            "#,
        )
        .bind(pro_days)
        .bind(free_days)
        .bind(BATCH_SIZE)
        .execute(pool)
        .await?
        .rows_affected();

        total += deleted;
        if (deleted as i64) < BATCH_SIZE {
            return Ok(total);
        }
    }
}
