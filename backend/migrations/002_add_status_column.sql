-- Add status column to track pending vs completed entries
ALTER TABLE entries
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'completed'
CHECK (status IN ('pending', 'completed'));

-- Add index for status filtering
CREATE INDEX idx_entries_status ON entries(status);

-- Set existing expenses to completed (they already happened)
UPDATE entries SET status = 'completed' WHERE type = 'expense';

-- Set existing income to pending (scheduled but not received yet)
UPDATE entries SET status = 'pending' WHERE type = 'income';

-- Add comment for documentation
COMMENT ON COLUMN entries.status IS 'Payment status: pending (scheduled/expected) or completed (received/paid)';
