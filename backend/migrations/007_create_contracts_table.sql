-- Create Contracts Table
-- Manages recurring client contracts for automatic income forecasting

CREATE TABLE contracts (
  id SERIAL PRIMARY KEY,
  client_name VARCHAR(255) NOT NULL,
  contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('monthly', 'yearly', 'one-time')),
  amount DECIMAL(12, 2) NOT NULL,
  payment_day INTEGER CHECK (payment_day >= 1 AND payment_day <= 31),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active contracts lookups
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);

-- Insert initial contract: Zidans
INSERT INTO contracts (client_name, contract_type, amount, payment_day, start_date, end_date, status, notes)
VALUES (
  'Zidans',
  'monthly',
  47000.00,
  22,
  '2024-10-01',
  '2025-10-01',
  'active',
  '1 year contract - $47,000/month paid on the 22nd'
);

-- Summary:
-- Created contracts table for managing recurring client agreements
-- Added Zidans contract: $47,000/month on the 22nd (Oct 2024 - Oct 2025)
