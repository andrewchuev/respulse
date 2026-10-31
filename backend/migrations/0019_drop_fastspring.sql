-- WayForPay is the only payment provider; FastSpring event tracking is no longer needed.
DROP TABLE IF EXISTS fastspring_events;

ALTER TABLE payment_transactions
    ALTER COLUMN provider SET DEFAULT 'WAYFORPAY',
    ALTER COLUMN recipient_email SET DEFAULT 'WayForPay';
