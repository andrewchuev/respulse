//! Downgrade policy: a team that drops from Pro to Free keeps everything for a grace period
//! (`DOWNGRADE_GRACE_DAYS`, default 7). After that the Free limits are applied without deleting data:
//!
//! * monitors beyond the Free limit (newest first) are paused and flagged `paused_by_plan`;
//! * probe intervals below the Free minimum are raised, remembering the original value;
//! * members beyond the Free seat count (owner and oldest accounts are kept) are suspended.
//!
//! The upgrade trigger in the database restores all of it (see migration 0020).

use crate::plans::{self, FREE};
use sqlx::PgPool;
use std::time::Duration;
use tracing::{error, info};
use uuid::Uuid;

const RUN_EVERY: Duration = Duration::from_secs(3600);

pub async fn run_loop(pool: PgPool) {
    loop {
        match enforce_due(&pool).await {
            Ok(0) => {}
            Ok(n) => info!("Plan downgrade enforcement applied to {} team(s)", n),
            Err(e) => error!("Plan downgrade enforcement failed: {:?}", e),
        }
        tokio::time::sleep(RUN_EVERY).await;
    }
}

/// Enforces the Free limits on every team whose grace period has run out; returns how many were changed.
pub async fn enforce_due(pool: &PgPool) -> Result<usize, sqlx::Error> {
    let teams: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM teams
         WHERE plan <> 'PRO' AND plan_downgraded_at IS NOT NULL
           AND plan_downgraded_at + make_interval(days => $1::int) <= NOW()",
    )
    .bind(plans::downgrade_grace_days() as i32)
    .fetch_all(pool)
    .await?;

    let mut changed = 0;
    for team_id in teams {
        if enforce_team(pool, team_id).await? {
            changed += 1;
        }
    }
    Ok(changed)
}

async fn enforce_team(pool: &PgPool, team_id: Uuid) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    // Same keys as the insert triggers, so enforcement never interleaves with a concurrent create.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended('monitors:' || $1::text, 0))")
        .bind(team_id)
        .execute(&mut *tx)
        .await?;

    let intervals = sqlx::query(
        "UPDATE monitors
         SET original_interval_seconds = COALESCE(original_interval_seconds, interval_seconds),
             interval_seconds = $2, updated_at = NOW()
         WHERE team_id = $1 AND interval_seconds < $2",
    )
    .bind(team_id)
    .bind(FREE.min_interval_seconds)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    let paused = sqlx::query(
        "UPDATE monitors
         SET is_paused = TRUE, paused_by_plan = TRUE, status = 'PAUSED', updated_at = NOW()
         WHERE id IN (
             SELECT id FROM monitors WHERE team_id = $1
             ORDER BY created_at ASC, id ASC OFFSET $2
         ) AND NOT is_paused",
    )
    .bind(team_id)
    .bind(FREE.max_monitors)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    let suspended = sqlx::query(
        "UPDATE users SET is_active = FALSE, suspended_by_plan = TRUE
         WHERE id IN (
             SELECT id FROM users WHERE team_id = $1 AND is_active
             ORDER BY (role = 'OWNER') DESC, created_at ASC, id ASC OFFSET $2
         )",
    )
    .bind(team_id)
    .bind(FREE.max_members)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;

    if intervals + paused + suspended > 0 {
        info!(
            "Team {} downgraded: {} interval(s) raised, {} monitor(s) paused, {} member(s) suspended",
            team_id, intervals, paused, suspended
        );
    }
    Ok(intervals + paused + suspended > 0)
}
