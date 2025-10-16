-- Add support for expense contracts (recurring expenses)
-- Contracts table currently only supports income, this extends it to support expenses too

-- Add contract_direction field to differentiate income vs expense contracts
ALTER TABLE contracts
ADD COLUMN contract_direction VARCHAR(10) NOT NULL DEFAULT 'income' CHECK (contract_direction IN ('income', 'expense'));

-- Rename client_name to party_name (more generic for vendors/clients)
ALTER TABLE contracts
RENAME COLUMN client_name TO party_name;

-- Add index for contract generation queries
CREATE INDEX idx_contracts_direction ON contracts(contract_direction);
CREATE INDEX IF NOT EXISTS idx_contracts_last_generated ON contracts(last_generated_date);

-- Add comments
COMMENT ON COLUMN contracts.contract_direction IS 'Direction of payment flow: income (we receive) or expense (we pay)';
COMMENT ON COLUMN contracts.party_name IS 'Client name (for income) or Vendor name (for expenses)';
COMMENT ON COLUMN contracts.last_generated_date IS 'Date when last auto-generated entry was created';

-- Insert example expense contract: Maryana car rental
INSERT INTO contracts (party_name, contract_type, amount, payment_day, start_date, end_date, status, contract_direction, notes)
VALUES (
  'Maryana Budzovych - Car Rental',
  'monthly',
  1641.70,
  26,
  '2025-08-01',
  NULL,
  'active',
  'expense',
  'Monthly recurring car rental expense'
);
