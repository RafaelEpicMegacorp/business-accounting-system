-- Link Contracts to Entries
-- Allows income entries to be automatically generated from contracts

-- Add contract_id foreign key to entries table
ALTER TABLE entries
ADD COLUMN contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE;

-- Create index for contract-generated entries lookups
CREATE INDEX idx_entries_contract_id ON entries(contract_id);

-- Add last_generated_date to contracts for tracking
ALTER TABLE contracts
ADD COLUMN last_generated_date DATE;

-- Summary:
-- Added contract_id to entries table to link contract-generated income entries
-- Added cascade delete so removing a contract removes its generated entries
-- Added last_generated_date to contracts for tracking generation status
