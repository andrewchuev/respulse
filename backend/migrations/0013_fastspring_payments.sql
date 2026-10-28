-- Migration 0013: FastSpring Payment Provider Update

ALTER TABLE payment_transactions
    ALTER COLUMN provider SET DEFAULT 'FASTSPRING',
    ALTER COLUMN recipient_email SET DEFAULT 'FastSpring (reslab)';

UPDATE payment_transactions
SET provider = 'FASTSPRING',
    recipient_email = 'FastSpring (reslab)'
WHERE provider = 'PAYPAL';

UPDATE teams
SET subscription_provider = 'FASTSPRING'
WHERE subscription_provider = 'PAYPAL';
