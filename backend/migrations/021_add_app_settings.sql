-- Migration: Add app settings and LLM analysis cache tables
-- Enables OpenAI-powered recurring expense detection

-- App settings table for storing configuration (API keys, preferences)
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LLM analysis cache to reduce API costs
CREATE TABLE IF NOT EXISTS llm_analysis_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Create index for cache expiration lookups
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_analysis_cache(expires_at);

-- Add LLM-related columns to recurring_expense_patterns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'source') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN source VARCHAR(20) DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'llm_reasoning') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN llm_reasoning TEXT;
  END IF;
END $$;

-- Insert default settings
INSERT INTO app_settings (key, value, is_encrypted, description) VALUES
  ('openai_enabled', 'false', false, 'Enable OpenAI-powered expense analysis'),
  ('openai_model', 'gpt-4-turbo-preview', false, 'OpenAI model to use for analysis'),
  ('llm_cache_hours', '24', false, 'Hours to cache LLM analysis results')
ON CONFLICT (key) DO NOTHING;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_timestamp();
