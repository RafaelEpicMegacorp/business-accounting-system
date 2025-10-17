-- ============================================
-- MIGRATION 009: Wise Integration
-- ============================================
-- This migration adds support for Wise transaction syncing,
-- automatic classification, and employee salary matching.

-- Create wise_transactions table to store raw Wise transaction data
CREATE TABLE wise_transactions (
    id SERIAL PRIMARY KEY,
    wise_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    wise_resource_id VARCHAR(255),
    profile_id VARCHAR(255) NOT NULL,
    account_id VARCHAR(255),

    -- Transaction details
    type VARCHAR(50) NOT NULL, -- 'CREDIT' or 'DEBIT'
    state VARCHAR(50) NOT NULL, -- 'COMPLETED', 'PENDING', etc.
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,

    -- Transaction metadata
    description TEXT,
    merchant_name VARCHAR(255),
    reference_number VARCHAR(255),

    -- Dates
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    value_date TIMESTAMP WITH TIME ZONE,

    -- Processing status
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'processed', 'failed', 'skipped')),
    processing_error TEXT,

    -- Classification results
    classified_category VARCHAR(50),
    matched_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    needs_review BOOLEAN NOT NULL DEFAULT false,

    -- Link to created entry
    entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,

    -- Raw webhook payload for debugging
    raw_payload JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    CONSTRAINT check_amount_not_zero CHECK (amount != 0)
);

-- Create indexes for wise_transactions
CREATE INDEX idx_wise_transactions_wise_id ON wise_transactions(wise_transaction_id);
CREATE INDEX idx_wise_transactions_sync_status ON wise_transactions(sync_status);
CREATE INDEX idx_wise_transactions_needs_review ON wise_transactions(needs_review) WHERE needs_review = true;
CREATE INDEX idx_wise_transactions_transaction_date ON wise_transactions(transaction_date);
CREATE INDEX idx_wise_transactions_entry_id ON wise_transactions(entry_id);
CREATE INDEX idx_wise_transactions_employee_id ON wise_transactions(matched_employee_id);

-- Add comment for documentation
COMMENT ON TABLE wise_transactions IS 'Stores Wise bank transactions for syncing with accounting entries';
COMMENT ON COLUMN wise_transactions.sync_status IS 'Processing status: pending (not yet processed), processed (entry created), failed (error occurred), skipped (ignored by rules)';
COMMENT ON COLUMN wise_transactions.confidence_score IS 'Auto-matching confidence score (0-100): >80 = auto-create, <80 = needs review';

-- Update entries table to track Wise-synced entries
ALTER TABLE entries
ADD COLUMN wise_transaction_id VARCHAR(255) REFERENCES wise_transactions(wise_transaction_id) ON DELETE SET NULL,
ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN auto_matched_confidence INTEGER CHECK (auto_matched_confidence >= 0 AND auto_matched_confidence <= 100);

-- Create index for Wise-linked entries
CREATE INDEX idx_entries_wise_transaction ON entries(wise_transaction_id);
CREATE INDEX idx_entries_needs_review ON entries(needs_review) WHERE needs_review = true;

-- Add comments
COMMENT ON COLUMN entries.wise_transaction_id IS 'Link to Wise transaction that created this entry (if auto-synced)';
COMMENT ON COLUMN entries.needs_review IS 'Flag for entries that need manual review/confirmation';
COMMENT ON COLUMN entries.auto_matched_confidence IS 'Confidence score for auto-matched entries (e.g., salary matching)';

-- Create classification rules table for future extensibility
CREATE TABLE wise_classification_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    keyword_pattern VARCHAR(255) NOT NULL,
    target_category VARCHAR(50) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active rules
CREATE INDEX idx_classification_rules_active ON wise_classification_rules(is_active, priority DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_classification_rules_updated_at
    BEFORE UPDATE ON wise_classification_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default classification rules
INSERT INTO wise_classification_rules (rule_name, keyword_pattern, target_category, priority) VALUES
('Cloud Services', '(?i)(aws|amazon web services|google cloud|gcp|azure|digitalocean|heroku|vercel)', 'Software', 100),
('Development Tools', '(?i)(github|gitlab|jira|slack|discord|notion|clickup|trello|asana)', 'Software', 90),
('Office Rent', '(?i)(rent|lease|landlord|property)', 'Administration', 80),
('Utilities', '(?i)(internet|electricity|water|gas|utilities|phone|mobile)', 'Administration', 80),
('Software Licenses', '(?i)(license|subscription|saas|software)', 'Software', 70),
('Office Supplies', '(?i)(supplies|stationery|equipment|furniture)', 'Administration', 60),
('Marketing', '(?i)(ads|advertising|marketing|social media|facebook|google ads)', 'Marketing', 70),
('Legal Services', '(?i)(legal|lawyer|attorney|law firm)', 'Professional Services', 60),
('Accounting Services', '(?i)(accountant|bookkeeping|tax|audit)', 'Professional Services', 60),
('Bank Fees', '(?i)(bank fee|service charge|transaction fee|wire fee)', 'Bank Fees', 50);

-- Add comment
COMMENT ON TABLE wise_classification_rules IS 'Keyword-based rules for auto-classifying Wise transactions into expense categories';

-- Create audit log table for tracking changes to Wise-synced entries
CREATE TABLE wise_sync_audit_log (
    id SERIAL PRIMARY KEY,
    wise_transaction_id VARCHAR(255) NOT NULL,
    entry_id INTEGER,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'reviewed', 'rejected'
    performed_by VARCHAR(255), -- user who performed the action
    old_values JSONB,
    new_values JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for audit log
CREATE INDEX idx_wise_sync_audit_log_transaction ON wise_sync_audit_log(wise_transaction_id);
CREATE INDEX idx_wise_sync_audit_log_entry ON wise_sync_audit_log(entry_id);
CREATE INDEX idx_wise_sync_audit_log_created_at ON wise_sync_audit_log(created_at DESC);

COMMENT ON TABLE wise_sync_audit_log IS 'Audit trail for all actions taken on Wise-synced transactions and entries';
