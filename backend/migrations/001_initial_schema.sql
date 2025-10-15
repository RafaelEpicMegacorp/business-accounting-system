-- Create entries table with date tracking
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    detail TEXT,
    base_amount DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_entries_type ON entries(type);
CREATE INDEX idx_entries_category ON entries(category);
CREATE INDEX idx_entries_date ON entries(entry_date);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data with dates
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date) VALUES
('expense', 'Employee', 'Salary', 'AJ', 10000.00, 10000.00, CURRENT_DATE),
('expense', 'Employee', 'Asif', 'Employee', 3000.00, 3360.00, CURRENT_DATE),
('expense', 'Employee', 'Shaheer', 'Employee', 3000.00, 3360.00, CURRENT_DATE),
('expense', 'Employee', 'Danche', 'Employee', 2800.00, 3136.00, CURRENT_DATE),
('expense', 'Employee', 'Rohit', 'Employee', 0.00, 0.00, CURRENT_DATE),
('expense', 'Employee', 'Yavuz', 'Employee', 3000.00, 3360.00, CURRENT_DATE),
('expense', 'Employee', 'Tihomir', 'Employee', 100.00, 112.00, CURRENT_DATE),
('expense', 'Employee', 'Mariele', 'Employee', 1600.00, 1792.00, CURRENT_DATE),
('expense', 'Employee', 'Joel', 'Employee', 1600.00, 1792.00, CURRENT_DATE),
('expense', 'Administration', 'Rent', '', 1000.00, 1120.00, CURRENT_DATE),
('expense', 'Administration', 'Internet/Electricity', '', 250.00, 280.00, CURRENT_DATE),
('expense', 'Employee', 'Rafael', 'Employee', 10000.00, 11200.00, CURRENT_DATE),
('expense', 'Employee', 'Bushan', 'Employee', 3000.00, 3360.00, CURRENT_DATE),
('expense', 'Software', 'Softwares', 'Clickup, Slack, Google Cloud, Claude', 1200.00, 1344.00, CURRENT_DATE);
