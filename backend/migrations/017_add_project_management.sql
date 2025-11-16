-- Migration 017: Add Project Management System
-- Description: Creates projects table and employee_projects junction table for many-to-many relationships
-- Date: 2025-11-16

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
    color VARCHAR(7) DEFAULT '#3B82F6',
    client_name VARCHAR(255),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(status) WHERE status = 'active';

-- Create trigger for projects updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create employee_projects junction table (many-to-many)
CREATE TABLE IF NOT EXISTS employee_projects (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    removed_date DATE,
    is_primary BOOLEAN DEFAULT false,
    role VARCHAR(100),
    allocation_percentage DECIMAL(5, 2) DEFAULT 100.00 CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (employee_id, project_id)
);

-- Create indexes for employee_projects
CREATE INDEX IF NOT EXISTS idx_employee_projects_employee ON employee_projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_projects_project ON employee_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_employee_projects_active ON employee_projects(employee_id, project_id) WHERE removed_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_projects_primary ON employee_projects(employee_id) WHERE is_primary = true;

-- Insert default projects
INSERT INTO projects (name, description, status, color, start_date)
VALUES
    ('ZidansAI', 'Default company project - AI development and consulting', 'active', '#3B82F6', '2024-01-01'),
    ('MorichalAI', 'Secondary AI project - Specialized solutions', 'active', '#10B981', '2024-01-01')
ON CONFLICT (name) DO NOTHING;

-- Assign all existing employees to ZidansAI by default as their primary project
INSERT INTO employee_projects (employee_id, project_id, is_primary, assigned_date)
SELECT
    e.id,
    p.id,
    true,
    COALESCE(e.start_date, CURRENT_DATE)
FROM employees e
CROSS JOIN projects p
WHERE p.name = 'ZidansAI'
  AND e.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM employee_projects ep
    WHERE ep.employee_id = e.id
  )
ON CONFLICT (employee_id, project_id) DO NOTHING;

-- Add comment to tables
COMMENT ON TABLE projects IS 'Stores project information for employee assignment and tracking';
COMMENT ON TABLE employee_projects IS 'Junction table for many-to-many relationship between employees and projects';
COMMENT ON COLUMN employee_projects.is_primary IS 'Marks the primary project for an employee (only one per employee)';
COMMENT ON COLUMN employee_projects.allocation_percentage IS 'Percentage of time employee spends on this project (100 = full-time)';
