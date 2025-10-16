-- Add multi-currency support to entries table
-- This allows tracking original currency amounts and exchange rates

ALTER TABLE entries
ADD COLUMN bank_account VARCHAR(10) CHECK (bank_account IN ('USD', 'EUR', 'GBP', 'PLN')),
ADD COLUMN original_currency VARCHAR(3),
ADD COLUMN original_amount DECIMAL(12, 2),
ADD COLUMN exchange_rate DECIMAL(10, 6),
ADD COLUMN transaction_reference VARCHAR(255);

-- Add indexes for currency queries
CREATE INDEX idx_entries_bank_account ON entries(bank_account);
CREATE INDEX idx_entries_currency ON entries(original_currency);

-- Add comments for documentation
COMMENT ON COLUMN entries.bank_account IS 'Wise account where transaction occurred (USD/EUR/GBP/PLN)';
COMMENT ON COLUMN entries.original_currency IS 'Original transaction currency code (e.g., EUR, PLN)';
COMMENT ON COLUMN entries.original_amount IS 'Original transaction amount before conversion';
COMMENT ON COLUMN entries.exchange_rate IS 'Exchange rate used for USD conversion';
COMMENT ON COLUMN entries.transaction_reference IS 'Bank statement transaction ID or reference number';

-- Default existing entries to USD (they are already in USD)
UPDATE entries
SET bank_account = 'USD',
    original_currency = 'USD',
    original_amount = total,
    exchange_rate = 1.000000
WHERE bank_account IS NULL;
