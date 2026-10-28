-- Migration: 0005_incident_management.sql
-- Add business fields and post-mortem support to incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS severity VARCHAR(50) NOT NULL DEFAULT 'MAJOR';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'INVESTIGATING';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS post_mortem TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_incidents_stage ON incidents(stage);
CREATE INDEX IF NOT EXISTS idx_incidents_published ON incidents(is_published);

-- Populate default titles for existing incidents
UPDATE incidents i
SET title = m.name || ' Service Disruption'
FROM monitors m
WHERE i.monitor_id = m.id AND (i.title IS NULL OR i.title = '');

-- Update stage for already resolved incidents
UPDATE incidents SET stage = 'RESOLVED' WHERE status = 'RESOLVED' AND stage = 'INVESTIGATING';

-- Timeline updates for incidents
CREATE TABLE IF NOT EXISTS incident_updates (
    id BIGSERIAL PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL DEFAULT 'INVESTIGATING',
    message TEXT NOT NULL,
    author VARCHAR(100) NOT NULL DEFAULT 'Incident Response Team',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id, created_at ASC);
