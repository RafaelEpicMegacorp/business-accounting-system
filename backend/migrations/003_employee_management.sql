-- Create employees table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    pay_type VARCHAR(20) NOT NULL CHECK (pay_type IN ('monthly', 'weekly', 'hourly')),
    pay_rate DECIMAL(12, 2) NOT NULL,
    pay_multiplier DECIMAL(5, 4) NOT NULL DEFAULT 1.0000,
    start_date DATE NOT NULL,
    termination_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for employees
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_employees_pay_type ON employees(pay_type);
CREATE INDEX idx_employees_name ON employees(name);

-- Add employee_id to entries table
ALTER TABLE entries
ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX idx_entries_employee ON entries(employee_id);

-- Create trigger for employees updated_at
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing employee data from entries
-- Extract unique employee names and create employee records
INSERT INTO employees (name, pay_type, pay_rate, pay_multiplier, start_date, is_active)
SELECT DISTINCT
    description as name,
    'monthly' as pay_type,
    base_amount as pay_rate,
    CASE
        WHEN base_amount > 0 THEN total / base_amount
        ELSE 1.0000
    END as pay_multiplier,
    MIN(entry_date) as start_date,
    true as is_active
FROM entries
WHERE category = 'Employee'
    AND type = 'expense'
    AND description NOT IN ('Salary')
GROUP BY description, base_amount, total
HAVING base_amount > 0;

-- Link existing entries to employee records
UPDATE entries e
SET employee_id = emp.id
FROM employees emp
WHERE e.category = 'Employee'
    AND e.type = 'expense'
    AND e.description = emp.name;
