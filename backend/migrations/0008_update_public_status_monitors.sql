-- Migration: 0008_update_public_status_monitors.sql
-- Replace third-party GitHub demo monitors with authoritative ResPulse platform self-monitoring

-- 1. Update GitHub API to ResPulse Web Application
UPDATE monitors
SET name = 'ResPulse Web Application',
    url = 'https://respulse.online',
    monitor_type = 'HTTP',
    group_name = 'Platform',
    status = 'UP',
    interval_seconds = 30,
    tags = ARRAY['web', 'frontend', 'production'],
    last_error = NULL,
    updated_at = NOW()
WHERE id = 'b5fe9273-6299-4c27-a1b2-0f27ea0f09aa';

-- 2. Update GitHub SSL Cert to ResPulse SSL Certificate
UPDATE monitors
SET name = 'ResPulse SSL Certificate',
    url = 'respulse.online',
    monitor_type = 'SSL',
    group_name = 'Security',
    status = 'UP',
    tags = ARRAY['ssl', 'tls', 'security'],
    last_error = NULL,
    updated_at = NOW()
WHERE id = 'b5f660ca-007e-4682-aa7c-957261f7554d';

-- 3. Update Google Search to ResPulse API Gateway
UPDATE monitors
SET name = 'ResPulse API Gateway',
    url = 'https://respulse.online/api/health',
    monitor_type = 'HTTP',
    group_name = 'Platform',
    status = 'UP',
    tags = ARRAY['api', 'backend', 'rust'],
    last_error = NULL,
    updated_at = NOW()
WHERE id = '717fcd5d-faae-4a83-b081-036f30f5eb2d';

-- 4. Update Cloudflare DNS to Primary DNS Resolver
UPDATE monitors
SET name = 'Primary DNS Resolver',
    group_name = 'Network',
    tags = ARRAY['network', 'dns', 'anycast'],
    updated_at = NOW()
WHERE id = '8bdeaeed-666b-46c7-8222-ca4fdfe73985';

-- 5. Update Database Backup Worker
UPDATE monitors
SET name = 'Database Automated Backup',
    group_name = 'Data Storage',
    tags = ARRAY['cron', 'backup', 'database'],
    updated_at = NOW()
WHERE id = '1e057d81-cb03-45a9-befd-f541b6832273';

-- 6. Clean up historical rate-limiting incidents from third-party GitHub API
DELETE FROM incident_updates 
WHERE incident_id IN (
    SELECT id FROM incidents 
    WHERE monitor_id = 'b5fe9273-6299-4c27-a1b2-0f27ea0f09aa'
);

DELETE FROM incidents 
WHERE monitor_id = 'b5fe9273-6299-4c27-a1b2-0f27ea0f09aa';

-- 7. Clean up failed rate-limit check results for that monitor so history is clean
DELETE FROM check_results 
WHERE monitor_id = 'b5fe9273-6299-4c27-a1b2-0f27ea0f09aa' 
  AND is_up = FALSE;
