-- Migration: 0009_heartbeat_enhancements.sql
-- Healthchecks.io-inspired Heartbeat enhancements:
-- 1. Grace period (grace_seconds)
-- 2. Start signal tracking (last_start_at)
-- 3. Execution duration tracking (last_duration_ms)
-- 4. Captured stdout/stderr payload (last_payload in monitors, payload in check_results)

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS grace_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_start_at TIMESTAMPTZ;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_duration_ms FLOAT;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_payload TEXT;

ALTER TABLE check_results ADD COLUMN IF NOT EXISTS payload TEXT;

-- Index on heartbeat_token for rapid lookups
CREATE INDEX IF NOT EXISTS idx_monitors_heartbeat_token ON monitors(heartbeat_token) WHERE heartbeat_token IS NOT NULL;
