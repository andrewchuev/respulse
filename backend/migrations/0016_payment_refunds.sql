-- Refunds arrive as separate FastSpring return events; keep them on the original transaction.
ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS refunded_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refund_ids TEXT[] NOT NULL DEFAULT '{}';
