-- Migration 0012: PayPal Payment Transactions and Subscriptions

ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS subscription_provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYPAL',
    transaction_id VARCHAR(100),
    payer_email VARCHAR(255),
    recipient_email VARCHAR(255) NOT NULL DEFAULT 'andrew.chuev@gmail.com',
    amount DOUBLE PRECISION NOT NULL DEFAULT 8.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    plan VARCHAR(50) NOT NULL DEFAULT 'PRO',
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_team ON payment_transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at DESC);
