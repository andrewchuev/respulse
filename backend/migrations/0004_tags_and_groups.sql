-- Migration: 0004_tags_and_groups.sql
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NOT NULL DEFAULT 'Default';

CREATE INDEX IF NOT EXISTS idx_monitors_group_name ON monitors(group_name);
CREATE INDEX IF NOT EXISTS idx_monitors_tags ON monitors USING GIN(tags);

-- Pre-populate existing monitors with categories and tags
UPDATE monitors SET group_name = 'Websites', tags = ARRAY['production', 'ecommerce', 'web'] WHERE name ILIKE '%kalyna%';
UPDATE monitors SET group_name = 'Websites', tags = ARRAY['production', 'agency', 'web'] WHERE name ILIKE '%reslab%';
UPDATE monitors SET group_name = 'Core APIs', tags = ARRAY['external', 'api', 'v3'] WHERE name ILIKE '%GitHub API%';
UPDATE monitors SET group_name = 'Core APIs', tags = ARRAY['external', 'search'] WHERE name ILIKE '%Google%';
UPDATE monitors SET group_name = 'Infrastructure', tags = ARRAY['dns', 'network', 'cloudflare'] WHERE name ILIKE '%Cloudflare%';
UPDATE monitors SET group_name = 'Infrastructure', tags = ARRAY['security', 'tls', 'cert'] WHERE name ILIKE '%SSL%';
UPDATE monitors SET group_name = 'Background Workers', tags = ARRAY['cron', 'backup', 'heartbeat'] WHERE name ILIKE '%Backup%';
