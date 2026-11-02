-- The operator's own organization is a flag instead of a hardcoded id, and the public status page
-- lists only monitors that were explicitly published.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_single_primary ON teams (is_primary) WHERE is_primary;
UPDATE teams SET is_primary = TRUE
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM teams WHERE is_primary);

ALTER TABLE monitors ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
-- Keeps the status page of existing installs unchanged right after the upgrade.
UPDATE monitors SET is_public = TRUE WHERE team_id IN (SELECT id FROM teams WHERE is_primary);
