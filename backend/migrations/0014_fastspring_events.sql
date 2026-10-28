-- Webhook deliveries are retried with the same event id; this table makes processing idempotent
-- and records why each event was applied or ignored.
CREATE TABLE IF NOT EXISTS fastspring_events (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    outcome VARCHAR(200) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
