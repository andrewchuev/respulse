-- Migration: 0010_cron_slugs_and_tag_routing.sql
-- Healthchecks.io-inspired enhancements:
-- 1. Team Ping Keys for slug-based pinging and auto-provisioning
-- 2. Monitor Slugs, Cron expressions, Timezones, and next expected execution time
-- 3. Tag-based notification channel filtering

-- 1. Team Ping Keys
ALTER TABLE teams ADD COLUMN IF NOT EXISTS ping_key VARCHAR(64) UNIQUE;
UPDATE teams SET ping_key = 'pk_live_enterprise0000000000001' WHERE id = '00000000-0000-0000-0000-000000000001' AND ping_key IS NULL;
UPDATE teams SET ping_key = REPLACE(gen_random_uuid()::text, '-', '') WHERE ping_key IS NULL;
ALTER TABLE teams ALTER COLUMN ping_key SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_ping_key ON teams(ping_key);

-- 2. Monitor Slugs, Cron Expressions & Timezones
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS cron_expression VARCHAR(100);
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NOT NULL DEFAULT 'UTC';
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS next_expected_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitors_team_slug ON monitors(team_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monitors_next_expected ON monitors(next_expected_at) WHERE next_expected_at IS NOT NULL;

-- Backfill slug for existing seeded backup monitor
UPDATE monitors SET slug = 'nightly-backup' WHERE heartbeat_token = '120780f60833469bb7506b92c1e77491' AND slug IS NULL;

-- 3. Notification Channels Tag Filtering
ALTER TABLE notification_channels ADD COLUMN IF NOT EXISTS filter_tags TEXT[] NOT NULL DEFAULT '{}';
