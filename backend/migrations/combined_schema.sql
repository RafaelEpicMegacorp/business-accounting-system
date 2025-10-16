-- Combined Database Schema for Railway Deployment
-- Business Accounting System
-- This file combines all migrations for fresh database setup

-- ============================================
-- MIGRATION 001: Initial Schema
-- ============================================

-- Create entries table with date tracking
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    detail TEXT,
    base_amount DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_entries_type ON entries(type);
CREATE INDEX idx_entries_category ON entries(category);
CREATE INDEX idx_entries_date ON entries(entry_date);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION 002: Add Status Column
-- ============================================

-- Add status column to track pending vs completed entries
ALTER TABLE entries
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'completed'
CHECK (status IN ('pending', 'completed'));

-- Add index for status filtering
CREATE INDEX idx_entries_status ON entries(status);

-- Add comment for documentation
COMMENT ON COLUMN entries.status IS 'Payment status: pending (scheduled/expected) or completed (received/paid)';

-- ============================================
-- MIGRATION 003: Employee Management
-- ============================================

-- Create employees table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    pay_type VARCHAR(20) NOT NULL CHECK (pay_type IN ('monthly', 'weekly', 'hourly')),
    pay_rate DECIMAL(12, 2) NOT NULL,
    pay_multiplier DECIMAL(5, 4) NOT NULL DEFAULT 1.0000,
    start_date DATE NOT NULL,
    termination_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for employees
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_employees_pay_type ON employees(pay_type);
CREATE INDEX idx_employees_name ON employees(name);

-- Add employee_id to entries table
ALTER TABLE entries
ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX idx_entries_employee ON entries(employee_id);

-- Create trigger for employees updated_at
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION 007: Create Contracts Table
-- ============================================

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

-- ============================================
-- MIGRATION 008: Link Contracts to Entries
-- ============================================

-- Add contract_id foreign key to entries table
ALTER TABLE entries
ADD COLUMN contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE;

-- Create index for contract-generated entries lookups
CREATE INDEX idx_entries_contract_id ON entries(contract_id);

-- Add last_generated_date to contracts for tracking
ALTER TABLE contracts
ADD COLUMN last_generated_date DATE;

-- ============================================
-- INITIAL DATA (Optional - Comment out if not needed)
-- ============================================

-- Insert sample expense entries
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status) VALUES
('expense', 'Administration', 'Rent', 'Office rent', 1000.00, 1120.00, CURRENT_DATE, 'completed'),
('expense', 'Administration', 'Internet/Electricity', 'Utilities', 250.00, 280.00, CURRENT_DATE, 'completed'),
('expense', 'Software', 'Softwares', 'Clickup, Slack, Google Cloud, Claude', 1200.00, 1344.00, CURRENT_DATE, 'completed');

-- Insert sample contract (Zidans)
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

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify tables were created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verify indexes
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- Check row counts
-- SELECT 'entries' as table_name, COUNT(*) as row_count FROM entries
-- UNION ALL
-- SELECT 'employees', COUNT(*) FROM employees
-- UNION ALL
-- SELECT 'contracts', COUNT(*) FROM contracts;
