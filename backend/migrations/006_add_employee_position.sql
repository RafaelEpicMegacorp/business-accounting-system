-- Add position field to employees table
ALTER TABLE employees
ADD COLUMN position VARCHAR(100);

-- Update existing employees with default position
UPDATE employees
SET position = 'Team Member'
WHERE position IS NULL;

-- Create index for position field
CREATE INDEX idx_employees_position ON employees(position);
