-- Complete Accounting Reset: Full Business History
-- Date: October 15, 2025 (Tuesday)
-- Last Friday: October 10, 2025

-- Clean slate
DELETE FROM entries;

-- =============================================================================
-- INCOME ENTRIES
-- =============================================================================

-- September 22, 2025 - Client Payment (Completed)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('income', 'Other', 'Client Payment', 'September payment received', 46500.00, 46500.00, '2025-09-22', 'completed', NULL);

-- October 22, 2025 - Client Payment (Pending)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('income', 'Other', 'Client Payment', 'October payment scheduled', 46500.00, 46500.00, '2025-10-22', 'pending', NULL);

-- =============================================================================
-- SEPTEMBER EXPENSES (All Completed)
-- =============================================================================

-- Weekly Payroll - Yavuz (started Sep 1, paid every Friday)
-- Sep 5 (Week 1)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Sep 5', 750.00, 840.00, '2025-09-05', 'completed', 9);

-- Sep 12 (Week 2)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Sep 12', 750.00, 840.00, '2025-09-12', 'completed', 9);

-- Sep 19 (Week 3)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Sep 19', 750.00, 840.00, '2025-09-19', 'completed', 9);

-- Sep 26 (Week 4)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Sep 26', 750.00, 840.00, '2025-09-26', 'completed', 9);

-- Monthly Payroll - Sep 30
-- Tihomir (full month from Aug 30)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Tihomir', 'September salary', 100.00, 112.00, '2025-09-30', 'completed', 8);

-- Fixed Expenses - Sep 30
-- Rent
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Administration', 'Rent', 'September office rent', 1000.00, 1120.00, '2025-09-30', 'completed', NULL);

-- Internet/Electricity
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Administration', 'Internet/Electricity', 'September utilities', 250.00, 280.00, '2025-09-30', 'completed', NULL);

-- Software subscriptions
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Software', 'Softwares', 'Clickup, Slack, Google Cloud, Claude - September', 1200.00, 1344.00, '2025-09-30', 'completed', NULL);

-- =============================================================================
-- OCTOBER EXPENSES - COMPLETED (up to last Friday Oct 10)
-- =============================================================================

-- Weekly Payroll - Oct 3 (Friday)
-- Yavuz
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Oct 3', 750.00, 840.00, '2025-10-03', 'completed', 9);

-- Danche (started Oct 1)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Danche', 'Week ending Oct 3', 700.00, 784.00, '2025-10-03', 'completed', 3);

-- Weekly Payroll - Oct 10 (Friday - last Friday)
-- Yavuz
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Oct 10', 750.00, 840.00, '2025-10-10', 'completed', 9);

-- Danche
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Danche', 'Week ending Oct 10', 700.00, 784.00, '2025-10-10', 'completed', 3);

-- =============================================================================
-- OCTOBER EXPENSES - PENDING (future payments)
-- =============================================================================

-- Weekly Payroll - Oct 17 (Friday)
-- Yavuz
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Oct 17', 750.00, 840.00, '2025-10-17', 'pending', 9);

-- Danche
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Danche', 'Week ending Oct 17', 700.00, 784.00, '2025-10-17', 'pending', 3);

-- Mariele (started Oct 12)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Mariele', 'Week ending Oct 17', 400.00, 448.00, '2025-10-17', 'pending', 5);

-- Weekly Payroll - Oct 24 (Friday)
-- Yavuz
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Oct 24', 750.00, 840.00, '2025-10-24', 'pending', 9);

-- Danche
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Danche', 'Week ending Oct 24', 700.00, 784.00, '2025-10-24', 'pending', 3);

-- Mariele
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Mariele', 'Week ending Oct 24', 400.00, 448.00, '2025-10-24', 'pending', 5);

-- Weekly Payroll - Oct 31 (Friday)
-- Yavuz
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week ending Oct 31', 750.00, 840.00, '2025-10-31', 'pending', 9);

-- Danche
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Danche', 'Week ending Oct 31', 700.00, 784.00, '2025-10-31', 'pending', 3);

-- Mariele
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Mariele', 'Week ending Oct 31', 400.00, 448.00, '2025-10-31', 'pending', 5);

-- Monthly Payroll - Oct 31 (PENDING)
-- Asif (started Oct 1)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Asif', 'October salary', 3000.00, 3360.00, '2025-10-31', 'pending', 1);

-- Bushan (started Oct 7)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Bushan', 'October salary', 3000.00, 3360.00, '2025-10-31', 'pending', 2);

-- Rafael (started Oct 13)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Rafael', 'October salary', 10000.00, 11200.00, '2025-10-31', 'pending', 6);

-- Tihomir
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Tihomir', 'October salary', 100.00, 112.00, '2025-10-31', 'pending', 8);

-- Fixed Expenses - Oct 31 (PENDING)
-- Rent
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Administration', 'Rent', 'October office rent', 1000.00, 1120.00, '2025-10-31', 'pending', NULL);

-- Internet/Electricity
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Administration', 'Internet/Electricity', 'October utilities', 250.00, 280.00, '2025-10-31', 'pending', NULL);

-- Software subscriptions
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Software', 'Softwares', 'Clickup, Slack, Google Cloud, Claude - October', 1200.00, 1344.00, '2025-10-31', 'pending', NULL);

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Completed Income: $46,500 (Sep 22)
-- Pending Income: $46,500 (Oct 22)
--
-- Completed Expenses:
-- - September: $6,216 (Yavuz 4 weeks + Tihomir + Fixed)
-- - October weeks 1-2: $3,248 (Yavuz + Danche)
-- - Total: $9,464
--
-- Pending Expenses:
-- - October weeks 3-5: $6,216 (Yavuz + Danche + Mariele × 3 Fridays)
-- - October monthly: $18,032 (Asif + Bushan + Rafael + Tihomir)
-- - October fixed: $2,744 (Rent + Utilities + Software)
-- - Total: $26,992
--
-- Current Balance (Oct 15): $46,500 - $9,464 = $37,036
-- Forecasted Balance (Oct 31): $37,036 + $46,500 - $26,992 = $56,544
