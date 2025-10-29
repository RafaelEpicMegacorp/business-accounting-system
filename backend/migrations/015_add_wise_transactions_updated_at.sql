-- ============================================
-- MIGRATION 015: Add updated_at to wise_transactions
-- ============================================
-- This migration adds the missing updated_at column to wise_transactions table
-- which is required by the wiseTransactionReviewModel queries.

-- Add updated_at column with default value
ALTER TABLE wise_transactions
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_wise_transactions_updated_at
    BEFORE UPDATE ON wise_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON COLUMN wise_transactions.updated_at IS 'Timestamp of last update to the transaction record';
