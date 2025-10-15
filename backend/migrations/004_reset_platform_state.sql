-- Platform Reset: Clean State for New Accounting Period
-- Assumption: Last month (September) fully paid, weekly employees paid through last week
-- Starting cashflow: $12,000

-- Step 1: Clean slate - delete all existing entries
DELETE FROM entries;

-- Step 2: Starting Balance (October 1, 2025)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('income', 'Other', 'Starting Balance', 'October opening balance', 12000.00, 12000.00, '2025-10-01', 'completed', NULL);

-- Step 3: September Monthly Payroll (Completed - Sep 30, 2025)
-- Asif: $3,000 × 1.12 = $3,360
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Asif', 'September salary', 3000.00, 3360.00, '2025-09-30', 'completed', 1);

-- Bushan: $3,000 × 1.12 = $3,360
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Bushan', 'September salary', 3000.00, 3360.00, '2025-09-30', 'completed', 2);

-- Rafael: $10,000 × 1.12 = $11,200
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Rafael', 'September salary', 10000.00, 11200.00, '2025-09-30', 'completed', 6);

-- Joel: $1,600 × 1.12 = $1,792
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Joel', 'September salary', 1600.00, 1792.00, '2025-09-30', 'completed', 4);

-- Tihomir: $100 × 1.12 = $112
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Tihomir', 'September salary', 100.00, 112.00, '2025-09-30', 'completed', 8);

-- Step 4: September Fixed Expenses (Completed)
-- Rent
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Administration', 'Rent', 'September office rent', 1000.00, 1120.00, '2025-09-30', 'completed', NULL);

-- Internet/Electricity
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Administration', 'Internet/Electricity', 'September utilities', 250.00, 280.00, '2025-09-30', 'completed', NULL);

-- Software subscriptions
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Software', 'Softwares', 'Clickup, Slack, Google Cloud, Claude - September', 1200.00, 1344.00, '2025-09-30', 'completed', NULL);

-- Step 5: October Week 1-2 Weekly Payroll (Completed through Oct 13)
-- Shaheer: 2 weeks × $700 × 1.05 = $1,470 (started Sep 29)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Shaheer', 'Week 1-2 (Sep 29 - Oct 12)', 1400.00, 1470.00, '2025-10-13', 'completed', 7);

-- Yavuz: 2 weeks × $750 × 1.12 = $1,680 (started Sep 1)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Yavuz', 'Week 1-2 (Sep 29 - Oct 12)', 1500.00, 1680.00, '2025-10-13', 'completed', 9);

-- Danche: 2 weeks × $700 × 1.12 = $1,568 (started Oct 1)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Danche', 'Week 1-2 (Oct 1 - Oct 14)', 1400.00, 1568.00, '2025-10-13', 'completed', 3);

-- Mariele: 1 week × $400 × 1.12 = $448 (started Oct 12, only 1 week)
INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
VALUES ('expense', 'Employee', 'Mariele', 'Week 1 (Oct 12 - Oct 18)', 400.00, 448.00, '2025-10-13', 'completed', 5);

-- Summary:
-- Starting Balance: $12,000.00
-- September Payroll: -$19,824.00 (Asif 3360 + Bushan 3360 + Rafael 11200 + Joel 1792 + Tihomir 112)
-- September Fixed: -$2,744.00 (Rent 1120 + Utilities 280 + Software 1344)
-- October Weeks 1-2: -$5,166.00 (Shaheer 1470 + Yavuz 1680 + Danche 1568 + Mariele 448)
-- = Current Balance: -$15,734.00 (DEFICIT)
--
-- Note: Company is currently operating at a deficit.
-- October monthly payroll (due Oct 31) and remaining weekly payroll still pending.
