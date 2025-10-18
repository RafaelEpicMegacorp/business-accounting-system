-- Fix currency balance calculation to only count Wise entries
-- This prevents employee salaries and other business expenses from affecting Wise account balances

-- Drop the old function
DROP FUNCTION IF EXISTS recalculate_currency_balances();

-- Create improved function that only counts Wise-related entries
CREATE OR REPLACE FUNCTION recalculate_currency_balances()
RETURNS void AS $$
DECLARE
  curr_record RECORD;
  income_total DECIMAL(15, 2);
  expense_total DECIMAL(15, 2);
BEGIN
  -- For each currency in use (only from Wise entries and opening balances)
  FOR curr_record IN
    SELECT DISTINCT currency
    FROM entries
    WHERE currency IS NOT NULL
      AND (detail LIKE '%Wise ID:%' OR detail LIKE '%Opening Balance%')
  LOOP
    -- Calculate total income in this currency (ONLY Wise + Opening Balance entries)
    SELECT COALESCE(SUM(amount_original), 0) INTO income_total
    FROM entries
    WHERE currency = curr_record.currency
      AND type = 'income'
      AND status = 'completed'
      AND (detail LIKE '%Wise ID:%' OR detail LIKE '%Opening Balance%');

    -- Calculate total expenses in this currency (ONLY Wise + Opening Balance entries)
    SELECT COALESCE(SUM(amount_original), 0) INTO expense_total
    FROM entries
    WHERE currency = curr_record.currency
      AND type = 'expense'
      AND status = 'completed'
      AND (detail LIKE '%Wise ID:%' OR detail LIKE '%Opening Balance%');

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

-- Insert opening balance entries to reconcile CSV data with actual Wise balances
-- These entries account for missing transaction history outside the CSV date range (Aug 20 - Oct 17)

-- USD: Need to reduce by $220.41 (CSV shows more than Wise current balance)
INSERT INTO entries
  (type, category, description, detail, base_amount, total, currency, amount_original, amount_usd, exchange_rate, entry_date, status)
VALUES
  ('expense', 'other_expenses', 'Opening Balance Adjustment', 'Opening Balance - Pre-CSV reconciliation to match Wise account',
   220.41, 220.41, 'USD', 220.41, 220.41, 1.0, '2025-08-19', 'completed');

-- PLN: Need to increase by 117.54 PLN (CSV shows less than Wise current balance)
INSERT INTO entries
  (type, category, description, detail, base_amount, total, currency, amount_original, amount_usd, exchange_rate, entry_date, status)
VALUES
  ('income', 'other_income', 'Opening Balance Adjustment', 'Opening Balance - Pre-CSV reconciliation to match Wise account',
   117.54, 117.54, 'PLN', 117.54, 31.74, 0.27, '2025-08-19', 'completed');

-- EUR: Need to reduce by 171.37 EUR (CSV shows EUR but Wise current balance is 0)
INSERT INTO entries
  (type, category, description, detail, base_amount, total, currency, amount_original, amount_usd, exchange_rate, entry_date, status)
VALUES
  ('expense', 'other_expenses', 'Opening Balance Adjustment', 'Opening Balance - Pre-CSV reconciliation to match Wise account',
   171.37, 171.37, 'EUR', 171.37, 188.51, 1.1, '2025-08-19', 'completed');

-- Run the fixed recalculate function
SELECT recalculate_currency_balances();

-- Verify the results
SELECT currency, balance, last_updated FROM currency_balances ORDER BY currency;
