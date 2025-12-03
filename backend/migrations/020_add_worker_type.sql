-- Migration: Add worker_type column to employees table
-- Distinguishes between employees (subject to ZUS) and contractors (pay own taxes)

-- Add worker_type column with default 'contractor'
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS worker_type VARCHAR(20) DEFAULT 'contractor';

-- Add check constraint
ALTER TABLE employees
ADD CONSTRAINT check_worker_type CHECK (worker_type IN ('employee', 'contractor'));

-- Set all existing workers to contractor (they pay their own taxes)
UPDATE employees SET worker_type = 'contractor' WHERE worker_type IS NULL;

-- Create index for filtering by worker type
CREATE INDEX IF NOT EXISTS idx_employees_worker_type ON employees(worker_type);

-- Summary:
-- - Added worker_type column: 'employee' or 'contractor'
-- - Default is 'contractor' (handles own taxes)
-- - Employees are subject to employer ZUS contributions
-- - Contractors are excluded from ZUS calculations
