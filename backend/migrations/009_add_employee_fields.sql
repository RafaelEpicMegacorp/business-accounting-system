-- Add additional employee fields for manual data entry
-- Supports role, birthday, location, LinkedIn, CV, contract/NDA status, employment type, and comments

ALTER TABLE employees
ADD COLUMN role VARCHAR(100),
ADD COLUMN birthday DATE,
ADD COLUMN location VARCHAR(255),
ADD COLUMN linkedin_url TEXT,
ADD COLUMN cv_url TEXT,
ADD COLUMN contract_signed BOOLEAN DEFAULT false,
ADD COLUMN nda_signed BOOLEAN DEFAULT false,
ADD COLUMN full_time BOOLEAN DEFAULT true,
ADD COLUMN comments TEXT;

-- Create indexes for commonly filtered fields
CREATE INDEX idx_employees_role ON employees(role);
CREATE INDEX idx_employees_location ON employees(location);
CREATE INDEX idx_employees_full_time ON employees(full_time);
CREATE INDEX idx_employees_contract_signed ON employees(contract_signed);
CREATE INDEX idx_employees_nda_signed ON employees(nda_signed);

-- Add comments for documentation
COMMENT ON COLUMN employees.role IS 'Employee position or job title';
COMMENT ON COLUMN employees.birthday IS 'Employee date of birth';
COMMENT ON COLUMN employees.location IS 'Employee work location or city';
COMMENT ON COLUMN employees.linkedin_url IS 'LinkedIn profile URL';
COMMENT ON COLUMN employees.cv_url IS 'CV/Resume file URL';
COMMENT ON COLUMN employees.contract_signed IS 'Contract signed status';
COMMENT ON COLUMN employees.nda_signed IS 'NDA signed status';
COMMENT ON COLUMN employees.full_time IS 'Full-time employment status';
COMMENT ON COLUMN employees.comments IS 'General notes or comments about employee';
