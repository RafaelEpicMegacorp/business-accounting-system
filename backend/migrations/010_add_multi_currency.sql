-- Add multi-currency support to entries table
-- This migration adds currency tracking while maintaining backward compatibility

-- Add currency columns to entries table
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS amount_original DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 6) DEFAULT 1.0;

-- Migrate existing data: set currency info for all existing entries
UPDATE entries
SET
  currency = 'USD',
  amount_original = total,
  amount_usd = total,
  exchange_rate = 1.0
WHERE currency IS NULL OR amount_original IS NULL;

-- Create index for currency queries
CREATE INDEX IF NOT EXISTS idx_entries_currency ON entries(currency);

-- Create currency_balances table to track balance per currency
CREATE TABLE IF NOT EXISTS currency_balances (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(3) NOT NULL UNIQUE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial currency balance rows
INSERT INTO currency_balances (currency, balance) VALUES
  ('USD', 0),
  ('PLN', 0),
  ('EUR', 0)
ON CONFLICT (currency) DO NOTHING;

-- Create currency_exchanges table to track currency conversions
CREATE TABLE IF NOT EXISTS currency_exchanges (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  from_amount DECIMAL(12, 2) NOT NULL,
  to_amount DECIMAL(12, 2) NOT NULL,
  exchange_rate DECIMAL(10, 6) NOT NULL,
  fee_amount DECIMAL(12, 2) DEFAULT 0,
  exchange_date DATE NOT NULL DEFAULT CURRENT_DATE,
  wise_id VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for currency_exchanges
CREATE INDEX IF NOT EXISTS idx_currency_exchanges_date ON currency_exchanges(exchange_date);
CREATE INDEX IF NOT EXISTS idx_currency_exchanges_wise_id ON currency_exchanges(wise_id);
CREATE INDEX IF NOT EXISTS idx_currency_exchanges_currencies ON currency_exchanges(from_currency, to_currency);

-- Create trigger to update currency_balances.last_updated
CREATE OR REPLACE FUNCTION update_currency_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_currency_balances_timestamp
    BEFORE UPDATE ON currency_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_currency_balance_timestamp();

-- Create function to recalculate currency balances from entries
CREATE OR REPLACE FUNCTION recalculate_currency_balances()
RETURNS void AS $$
DECLARE
  curr_record RECORD;
  income_total DECIMAL(15, 2);
  expense_total DECIMAL(15, 2);
BEGIN
  -- For each currency in use
  FOR curr_record IN SELECT DISTINCT currency FROM entries WHERE currency IS NOT NULL
  LOOP
    -- Calculate total income in this currency
    SELECT COALESCE(SUM(amount_original), 0) INTO income_total
    FROM entries
    WHERE currency = curr_record.currency AND type = 'income' AND status = 'completed';

    -- Calculate total expenses in this currency
    SELECT COALESCE(SUM(amount_original), 0) INTO expense_total
    FROM entries
    WHERE currency = curr_record.currency AND type = 'expense' AND status = 'completed';

    -- Update or insert the balance
    INSERT INTO currency_balances (currency, balance)
    VALUES (curr_record.currency, income_total - expense_total)
    ON CONFLICT (currency)
    DO UPDATE SET balance = income_total - expense_total, last_updated = CURRENT_TIMESTAMP;
  END LOOP;

  -- Handle currency exchanges (decrease from_currency, increase to_currency)
  FOR curr_record IN SELECT * FROM currency_exchanges
  LOOP
    -- Decrease from_currency balance
    UPDATE currency_balances
    SET balance = balance - curr_record.from_amount
    WHERE currency = curr_record.from_currency;

    -- Increase to_currency balance
    UPDATE currency_balances
    SET balance = balance + curr_record.to_amount
    WHERE currency = curr_record.to_currency;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run initial balance calculation
SELECT recalculate_currency_balances();
