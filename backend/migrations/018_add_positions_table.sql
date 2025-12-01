-- Migration 018: Add positions table for standardized employee positions
-- This converts the free-text position field to a dropdown selection

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert predefined positions
INSERT INTO positions (name, display_order) VALUES
  ('CEO', 1),
  ('CTO', 2),
  ('VP of Engineering', 3),
  ('Senior Lead', 4),
  ('Senior Engineer', 5),
  ('Frontend Engineer', 6),
  ('Project Manager', 7),
  ('QA Manager', 8),
  ('Quality Assurance', 9),
  ('HR', 10),
  ('Headhunter', 11),
  ('Administration', 12)
ON CONFLICT (name) DO NOTHING;

-- Add position_id column to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES positions(id);

-- Migrate existing position data to position_id using pattern matching
-- CEO
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'CEO')
  WHERE LOWER(position) = 'ceo' AND position_id IS NULL;

-- CTO
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'CTO')
  WHERE LOWER(position) = 'cto' AND position_id IS NULL;

-- Senior Engineer (including DevOps)
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'Senior Engineer')
  WHERE LOWER(position) SIMILAR TO '%(senior engineer|devops|developer)%' AND position_id IS NULL;

-- Frontend Engineer
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'Frontend Engineer')
  WHERE LOWER(position) SIMILAR TO '%(frontend|front-end)%' AND position_id IS NULL;

-- Senior Lead
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'Senior Lead')
  WHERE LOWER(position) SIMILAR TO '%(lead|leader)%' AND position_id IS NULL;

-- Project Manager
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'Project Manager')
  WHERE LOWER(position) = 'project manager' AND position_id IS NULL;

-- QA Manager
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'QA Manager')
  WHERE LOWER(position) = 'qa manager' AND position_id IS NULL;

-- Quality Assurance
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'Quality Assurance')
  WHERE LOWER(position) SIMILAR TO '%(qa|quality|tester)%' AND position_id IS NULL;

-- HR
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'HR')
  WHERE LOWER(position) SIMILAR TO '%(hr|human)%' AND position_id IS NULL;

-- Headhunter
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'Headhunter')
  WHERE LOWER(position) SIMILAR TO '%(headhunter|recruiter)%' AND position_id IS NULL;

-- Administration
UPDATE employees SET position_id = (SELECT id FROM positions WHERE name = 'Administration')
  WHERE LOWER(position) SIMILAR TO '%(admin|office)%' AND position_id IS NULL;

-- Keep the old position column as position_legacy for reference/rollback
-- Only rename if the column exists and hasn't been renamed yet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'position') THEN
    ALTER TABLE employees RENAME COLUMN position TO position_legacy;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_positions_display_order ON positions(display_order);
