-- ============================================
-- MIGRATION 014: Wise Enhanced Tracking
-- ============================================
-- This migration adds fields for enhanced Wise transaction tracking:
-- - Transfer fees
-- - Exchange rates
-- - Complete recipient/sender details

-- Add new columns to wise_transactions table
ALTER TABLE wise_transactions
ADD COLUMN IF NOT EXISTS transfer_fee DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS transfer_exchange_rate DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS recipient_details JSONB;

-- Add index for faster recipient queries using GIN index for JSONB
CREATE INDEX IF NOT EXISTS idx_wise_transactions_recipient_details
ON wise_transactions USING GIN (recipient_details);

-- Add comments for documentation
COMMENT ON COLUMN wise_transactions.transfer_fee IS 'Fee charged by Wise for this transfer';
COMMENT ON COLUMN wise_transactions.transfer_exchange_rate IS 'Exchange rate applied if currency conversion occurred';
COMMENT ON COLUMN wise_transactions.recipient_details IS 'Complete recipient/sender information including name, account number, bank code, and address (JSONB format)';

-- Example recipient_details structure:
-- {
--   "name": "John Doe",
--   "accountNumber": "GB29NWBK60161331926819",
--   "bankCode": "NWBKGB2L",
--   "address": {
--     "city": "London",
--     "country": "GB",
--     "postCode": "SW1A 1AA",
--     "firstLine": "123 Main Street"
--   },
--   "email": "john@example.com",
--   "legalType": "PERSON"
-- }
