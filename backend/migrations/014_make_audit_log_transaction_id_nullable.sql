-- ============================================
-- MIGRATION 014: Make wise_transaction_id Nullable in Audit Log
-- ============================================
-- This migration allows webhook audit logging for events that don't
-- have a transaction ID (test events, signature failures, unknown events, etc.)

-- Make wise_transaction_id nullable
ALTER TABLE wise_sync_audit_log
ALTER COLUMN wise_transaction_id DROP NOT NULL;

-- Update comment to reflect the change
COMMENT ON COLUMN wise_sync_audit_log.wise_transaction_id IS
'Wise transaction ID - nullable for webhook events that don''t create transactions (test events, signature failures, unknown events, processing errors)';

-- Verify the change (this is informational, will succeed silently)
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'wise_sync_audit_log'
-- AND column_name = 'wise_transaction_id';
