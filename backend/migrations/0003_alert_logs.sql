CREATE TABLE IF NOT EXISTS alert_logs (
    id BIGSERIAL PRIMARY KEY,
    channel_id UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'DOWN', 'RESOLVED', 'TEST'
    status VARCHAR(20) NOT NULL,     -- 'SUCCESS', 'FAILED'
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_channel_id ON alert_logs(channel_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at ON alert_logs(sent_at DESC);
