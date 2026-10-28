-- Migration 0011: Team Subscription Plans (Free vs Pro)

ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'FREE';

-- Ensure seeded enterprise team is on PRO plan
UPDATE teams
SET plan = 'PRO'
WHERE id = '00000000-0000-0000-0000-000000000001' OR ping_key = 'pk_live_enterprise0000000000001';

CREATE INDEX IF NOT EXISTS idx_teams_plan ON teams(plan);
