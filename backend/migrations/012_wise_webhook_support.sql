-- Add Wise webhook support for real-time transaction sync
-- This enables EU-compliant transaction syncing via webhooks instead of API polling

-- Store raw webhook events from Wise
CREATE TABLE wise_webhook_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  error_message TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for webhook event queries
CREATE INDEX idx_wise_webhook_event_type ON wise_webhook_events(event_type);
CREATE INDEX idx_wise_webhook_event_id ON wise_webhook_events(event_id);
CREATE INDEX idx_wise_webhook_processed ON wise_webhook_events(processed);
CREATE INDEX idx_wise_webhook_received_at ON wise_webhook_events(received_at);
CREATE INDEX idx_wise_webhook_resource ON wise_webhook_events(resource_type, resource_id);

-- Track Wise sync status and statistics
CREATE TABLE wise_sync_status (
  id SERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  last_webhook_received TIMESTAMP WITH TIME ZONE,
  last_balance_sync TIMESTAMP WITH TIME ZONE,
  last_manual_import TIMESTAMP WITH TIME ZONE,
  total_events_received INTEGER DEFAULT 0,
  total_events_processed INTEGER DEFAULT 0,
  total_events_failed INTEGER DEFAULT 0,
  current_balance_usd DECIMAL(15, 2),
  current_balance_eur DECIMAL(15, 2),
  current_balance_gbp DECIMAL(15, 2),
  current_balance_pln DECIMAL(15, 2),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for wise_sync_status updated_at
CREATE TRIGGER update_wise_sync_status_updated_at
  BEFORE UPDATE ON wise_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Track Wise transaction IDs to prevent duplicates
CREATE TABLE wise_transactions (
  id SERIAL PRIMARY KEY,
  wise_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  wise_transfer_id VARCHAR(255),
  wise_balance_id BIGINT,
  entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50),
  amount DECIMAL(15, 2),
  currency VARCHAR(3),
  status VARCHAR(50),
  merchant_name VARCHAR(255),
  description TEXT,
  transaction_date DATE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for wise_transactions
CREATE INDEX idx_wise_transactions_wise_id ON wise_transactions(wise_transaction_id);
CREATE INDEX idx_wise_transactions_transfer_id ON wise_transactions(wise_transfer_id);
CREATE INDEX idx_wise_transactions_entry_id ON wise_transactions(entry_id);
CREATE INDEX idx_wise_transactions_date ON wise_transactions(transaction_date);
CREATE INDEX idx_wise_transactions_currency ON wise_transactions(currency);

-- Create trigger for wise_transactions updated_at
CREATE TRIGGER update_wise_transactions_updated_at
  BEFORE UPDATE ON wise_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add Wise webhook secret to environment
COMMENT ON TABLE wise_webhook_events IS 'Stores raw webhook events from Wise for processing and audit trail';
COMMENT ON TABLE wise_sync_status IS 'Tracks Wise integration status, statistics, and current balances';
COMMENT ON TABLE wise_transactions IS 'Maps Wise transaction IDs to accounting entries for deduplication';

-- Insert initial sync status record
INSERT INTO wise_sync_status (
  profile_id,
  webhook_enabled,
  total_events_received,
  total_events_processed,
  total_events_failed
) VALUES (
  74801255, -- Profile ID from API test
  false,    -- Webhook not yet registered
  0,
  0,
  0
);

-- Add wise_transaction_id to entries table for linking
ALTER TABLE entries
ADD COLUMN wise_transaction_id VARCHAR(255) UNIQUE;

CREATE INDEX idx_entries_wise_transaction ON entries(wise_transaction_id);

COMMENT ON COLUMN entries.wise_transaction_id IS 'Link to Wise transaction ID for webhook-synced entries';
