-- Migration: Enhanced AI Expense Analysis
-- Adds classification taxonomy, AI suggestions tracking, and forecasting support

-- ============================================
-- 1. Expense Classifications (Hierarchical Taxonomy)
-- ============================================
CREATE TABLE IF NOT EXISTS expense_classifications (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER REFERENCES expense_classifications(id) ON DELETE SET NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_classifications_parent ON expense_classifications(parent_id);

-- ============================================
-- 2. AI Expense Suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS ai_expense_suggestions (
  id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  suggested_classification_id INTEGER REFERENCES expense_classifications(id) ON DELETE SET NULL,
  user_classification_id INTEGER REFERENCES expense_classifications(id) ON DELETE SET NULL,
  typical_amount DECIMAL(12, 2),
  amount_variance DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  frequency VARCHAR(20), -- weekly, monthly, quarterly, yearly
  confidence_score DECIMAL(5, 2),
  trend VARCHAR(20), -- increasing, decreasing, stable
  trend_rate DECIMAL(5, 4),
  reasoning TEXT,
  source_entry_ids INTEGER[],
  occurrence_count INTEGER DEFAULT 0,
  last_occurrence DATE,
  next_expected_date DATE,
  next_expected_amount DECIMAL(12, 2),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, modified
  user_notes TEXT,
  analysis_batch_id VARCHAR(50), -- Group suggestions from same analysis
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_expense_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_batch ON ai_expense_suggestions(analysis_batch_id);

-- ============================================
-- 3. Expense Forecasts
-- ============================================
CREATE TABLE IF NOT EXISTS expense_forecasts (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER REFERENCES recurring_expense_patterns(id) ON DELETE CASCADE,
  suggestion_id INTEGER REFERENCES ai_expense_suggestions(id) ON DELETE CASCADE,
  forecast_month DATE NOT NULL,
  expected_amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  expected_date DATE,
  confidence_score DECIMAL(5, 2),
  basis_description TEXT,
  is_confirmed BOOLEAN DEFAULT false,
  actual_entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  actual_amount DECIMAL(12, 2),
  variance_amount DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expense_forecasts_month ON expense_forecasts(forecast_month);
CREATE INDEX IF NOT EXISTS idx_expense_forecasts_pattern ON expense_forecasts(pattern_id);

-- ============================================
-- 4. Enhance recurring_expense_patterns
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'classification_id') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN classification_id INTEGER REFERENCES expense_classifications(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'month_variance') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN month_variance JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'trend') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN trend VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'trend_rate') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN trend_rate DECIMAL(5, 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'next_expected_date') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN next_expected_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'next_expected_amount') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN next_expected_amount DECIMAL(12, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'recurring_expense_patterns' AND column_name = 'occurrence_count') THEN
    ALTER TABLE recurring_expense_patterns ADD COLUMN occurrence_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 5. AI Decision Feedback (for learning)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_decision_feedback (
  id SERIAL PRIMARY KEY,
  suggestion_id INTEGER REFERENCES ai_expense_suggestions(id) ON DELETE CASCADE,
  decision VARCHAR(20) NOT NULL, -- accepted, rejected, modified
  original_classification_id INTEGER,
  final_classification_id INTEGER,
  original_amount DECIMAL(12, 2),
  modified_amount DECIMAL(12, 2),
  confidence_at_decision DECIMAL(5, 2),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_decision ON ai_decision_feedback(decision);

-- ============================================
-- 6. Seed Default Classifications
-- ============================================
INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
  ('Software & Services', NULL, 'Software subscriptions and digital services', true, 1),
  ('Office & Operations', NULL, 'Office-related expenses and operations', true, 2),
  ('Professional Services', NULL, 'External professional services', true, 3),
  ('Marketing & Sales', NULL, 'Marketing and sales expenses', true, 4),
  ('Financial', NULL, 'Financial fees and services', true, 5),
  ('Travel & Entertainment', NULL, 'Travel and entertainment expenses', true, 6),
  ('Other', NULL, 'Miscellaneous expenses', true, 7)
ON CONFLICT (name, parent_id) DO NOTHING;

-- Get parent IDs and insert subcategories
DO $$
DECLARE
  software_id INTEGER;
  office_id INTEGER;
  professional_id INTEGER;
  marketing_id INTEGER;
  financial_id INTEGER;
  travel_id INTEGER;
  other_id INTEGER;
BEGIN
  SELECT id INTO software_id FROM expense_classifications WHERE name = 'Software & Services' AND parent_id IS NULL;
  SELECT id INTO office_id FROM expense_classifications WHERE name = 'Office & Operations' AND parent_id IS NULL;
  SELECT id INTO professional_id FROM expense_classifications WHERE name = 'Professional Services' AND parent_id IS NULL;
  SELECT id INTO marketing_id FROM expense_classifications WHERE name = 'Marketing & Sales' AND parent_id IS NULL;
  SELECT id INTO financial_id FROM expense_classifications WHERE name = 'Financial' AND parent_id IS NULL;
  SELECT id INTO travel_id FROM expense_classifications WHERE name = 'Travel & Entertainment' AND parent_id IS NULL;
  SELECT id INTO other_id FROM expense_classifications WHERE name = 'Other' AND parent_id IS NULL;

  -- Software & Services subcategories
  INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
    ('Subscriptions', software_id, 'SaaS and subscription services', true, 1),
    ('Cloud Services', software_id, 'Cloud infrastructure and hosting', true, 2),
    ('Development Tools', software_id, 'Development and productivity tools', true, 3),
    ('Communication Tools', software_id, 'Communication and collaboration', true, 4)
  ON CONFLICT (name, parent_id) DO NOTHING;

  -- Office & Operations subcategories
  INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
    ('Rent', office_id, 'Office and workspace rent', true, 1),
    ('Utilities', office_id, 'Electricity, water, internet', true, 2),
    ('Office Supplies', office_id, 'General office supplies', true, 3),
    ('Equipment', office_id, 'Hardware and equipment', true, 4)
  ON CONFLICT (name, parent_id) DO NOTHING;

  -- Professional Services subcategories
  INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
    ('Legal', professional_id, 'Legal services and fees', true, 1),
    ('Accounting', professional_id, 'Accounting and bookkeeping', true, 2),
    ('Consulting', professional_id, 'Business consulting', true, 3)
  ON CONFLICT (name, parent_id) DO NOTHING;

  -- Marketing & Sales subcategories
  INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
    ('Advertising', marketing_id, 'Paid advertising', true, 1),
    ('Marketing Tools', marketing_id, 'Marketing software and tools', true, 2),
    ('Events', marketing_id, 'Conferences and events', true, 3)
  ON CONFLICT (name, parent_id) DO NOTHING;

  -- Financial subcategories
  INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
    ('Bank Fees', financial_id, 'Banking and transaction fees', true, 1),
    ('Payment Processing', financial_id, 'Payment gateway fees', true, 2),
    ('Insurance', financial_id, 'Business insurance', true, 3)
  ON CONFLICT (name, parent_id) DO NOTHING;

  -- Travel & Entertainment subcategories
  INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
    ('Transportation', travel_id, 'Flights, trains, rideshare', true, 1),
    ('Accommodation', travel_id, 'Hotels and lodging', true, 2),
    ('Meals & Entertainment', travel_id, 'Business meals', true, 3)
  ON CONFLICT (name, parent_id) DO NOTHING;

  -- Other subcategories
  INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order) VALUES
    ('Miscellaneous', other_id, 'General uncategorized', true, 1),
    ('One-time Expenses', other_id, 'Non-recurring expenses', true, 2)
  ON CONFLICT (name, parent_id) DO NOTHING;
END $$;

-- ============================================
-- 7. Monthly Analysis Summary (for caching)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_analysis_summary (
  id SERIAL PRIMARY KEY,
  analysis_month DATE NOT NULL,
  total_expenses DECIMAL(12, 2),
  recurring_total DECIMAL(12, 2),
  one_time_total DECIMAL(12, 2),
  pattern_count INTEGER,
  new_patterns INTEGER,
  cancelled_patterns INTEGER,
  anomalies JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(analysis_month)
);

CREATE INDEX IF NOT EXISTS idx_analysis_summary_month ON ai_analysis_summary(analysis_month);
