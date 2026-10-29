-- Webhook deliveries from WayForPay are retried until an approved ack is returned.
-- This table records merchant signatures to guarantee idempotent webhook processing.
CREATE TABLE IF NOT EXISTS wayforpay_events (
    signature VARCHAR(255) PRIMARY KEY,
    order_reference VARCHAR(150) NOT NULL,
    status VARCHAR(50) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wayforpay_events_order_ref ON wayforpay_events (order_reference);
