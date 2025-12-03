-- Migration: 019_add_forecast_enhancements.sql
-- Description: Add tax settings and recurring expense pattern tables for forecast feature
-- Date: 2025-12-03

-- Tax settings table for Poland LLC (Sp. z o.o.) configuration
CREATE TABLE IF NOT EXISTS tax_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Poland LLC tax settings
INSERT INTO tax_settings (setting_key, setting_value, description) VALUES
  ('cit_rate', '9', 'Corporate Income Tax rate (9% for small taxpayers, 19% standard)'),
  ('cit_threshold_eur', '2000000', 'Revenue threshold for small taxpayer status in EUR'),
  ('vat_rate', '23', 'Standard VAT rate'),
  ('zus_employer_rate', '20.48', 'Total employer ZUS contribution rate (pension 9.76% + disability 6.50% + accident 1.67% + labor fund 2.45% + FGSP 0.10%)'),
  ('company_type', 'sp_z_o_o', 'Company type: sp_z_o_o (LLC), jdg (sole proprietorship)')
ON CONFLICT (setting_key) DO NOTHING;

-- Recurring expense patterns table for auto-detected recurring expenses
CREATE TABLE IF NOT EXISTS recurring_expense_patterns (
  id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  typical_amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'PLN',
  frequency VARCHAR(20) CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  confidence_score DECIMAL(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  last_occurrence_date DATE,
  occurrence_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_user_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster pattern lookups
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_active ON recurring_expense_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_category ON recurring_expense_patterns(category);
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_frequency ON recurring_expense_patterns(frequency);

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_recurring_patterns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_recurring_patterns_updated_at ON recurring_expense_patterns;
CREATE TRIGGER update_recurring_patterns_updated_at
  BEFORE UPDATE ON recurring_expense_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_patterns_timestamp();

-- Trigger for tax_settings updated_at
CREATE OR REPLACE FUNCTION update_tax_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tax_settings_updated_at ON tax_settings;
CREATE TRIGGER update_tax_settings_updated_at
  BEFORE UPDATE ON tax_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_settings_timestamp();
