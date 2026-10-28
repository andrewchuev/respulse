-- Migration: 0007_tenant_isolation.sql
-- Full Multi-Tenancy & Tenant Isolation across Monitors, Incidents, Channels, and Stats

-- 1. Monitors isolation
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
UPDATE monitors SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE monitors ALTER COLUMN team_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monitors_team_id ON monitors(team_id);

-- 2. Notification Channels isolation
ALTER TABLE notification_channels ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
UPDATE notification_channels SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE notification_channels ALTER COLUMN team_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_channels_team_id ON notification_channels(team_id);

-- 3. Incidents isolation
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
UPDATE incidents i SET team_id = m.team_id FROM monitors m WHERE i.monitor_id = m.id AND i.team_id IS NULL;
UPDATE incidents SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
ALTER TABLE incidents ALTER COLUMN team_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_team_id ON incidents(team_id);
