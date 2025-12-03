-- Migration: Enhanced AI Learning from User Decisions
-- Adds detailed context to feedback for AI learning

-- ============================================
-- 1. Enhance ai_decision_feedback table
-- ============================================
ALTER TABLE ai_decision_feedback
ADD COLUMN IF NOT EXISTS description VARCHAR(255);

ALTER TABLE ai_decision_feedback
ADD COLUMN IF NOT EXISTS suggested_classification_name VARCHAR(100);

ALTER TABLE ai_decision_feedback
ADD COLUMN IF NOT EXISTS final_classification_name VARCHAR(100);

ALTER TABLE ai_decision_feedback
ADD COLUMN IF NOT EXISTS suggested_frequency VARCHAR(20);

ALTER TABLE ai_decision_feedback
ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(50);
-- Values: 'not_recurring', 'wrong_amount', 'wrong_classification',
--         'already_tracked', 'duplicate', 'other'

ALTER TABLE ai_decision_feedback
ADD COLUMN IF NOT EXISTS user_notes TEXT;

ALTER TABLE ai_decision_feedback
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- ============================================
-- 2. Add indexes for learning queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ai_feedback_description
ON ai_decision_feedback(description);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_rejection_reason
ON ai_decision_feedback(rejection_reason);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at
ON ai_decision_feedback(created_at);

-- ============================================
-- 3. Backfill existing records with descriptions
-- ============================================
UPDATE ai_decision_feedback f
SET description = s.description,
    suggested_classification_name = ec.name,
    suggested_frequency = s.frequency,
    currency = s.currency
FROM ai_expense_suggestions s
LEFT JOIN expense_classifications ec ON s.suggested_classification_id = ec.id
WHERE f.suggestion_id = s.id
  AND f.description IS NULL;
