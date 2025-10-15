-- Fix Starting Balance: Remove Historical Entries
-- The $12,000 represents current cashflow AFTER September expenses were paid
-- September is settled and should not count in current balance

-- Step 1: Clean slate - delete all existing entries
DELETE FROM entries;

-- Step 2: Starting Balance (October 15, 2025)
-- This $12,000 is what remains AFTER:
-- - September monthly payroll was paid
-- - September fixed expenses were paid
-- - October week 1-2 weekly payroll was paid
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('income', 'Other', 'Starting Balance', 'Current cashflow as of Oct 15, 2025', 12000.00, 12000.00, '2025-10-15', 'completed', NULL);

-- Summary:
-- Starting Balance: $12,000.00
-- = Current Balance: $12,000.00
--
-- Note: This is the actual current balance.
-- Previous expenses (September + Oct weeks 1-2) were already deducted.
