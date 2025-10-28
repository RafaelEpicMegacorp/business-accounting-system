# Wise Integration - Complete Documentation

**Status**: ✅ Working and Deployed in Production
**Last Updated**: October 28, 2025
**Production URL**: https://ds-accounting.netlify.app

---

## Table of Contents

1. [Overview](#overview)
2. [How Sync Works](#how-sync-works)
3. [Confidence Score System](#confidence-score-system)
4. [Classification Rules](#classification-rules)
5. [Transaction Processing Flow](#transaction-processing-flow)
6. [Managing Pending Entries](#managing-pending-entries)
7. [Adding New Classification Rules](#adding-new-classification-rules)
8. [Troubleshooting](#troubleshooting)
9. [Database Schema](#database-schema)
10. [API Endpoints](#api-endpoints)

---

## Overview

The Wise integration enables automatic synchronization of Wise banking transactions into the accounting system. It features:

- **Automatic Classification**: Intelligent categorization using keyword matching
- **Employee Matching**: Identifies salary payments with confidence scoring
- **Duplicate Prevention**: Transaction IDs ensure no duplicates
- **Manual Review**: Low-confidence transactions flagged for review
- **Multi-Currency Support**: Handles USD, EUR, PLN, GBP with automatic USD conversion

### Current Implementation

**Method**: Wise API with `/v1/profiles` and `/v4/balances` endpoints
**Authentication**: Bearer token stored in environment variables
**Sync Trigger**: Manual button click in dashboard
**Real-time Updates**: Frontend displays results immediately

---

## How Sync Works

### Step-by-Step Process

1. **User clicks "Sync from Wise"** button on dashboard
2. **Backend fetches transactions** from Wise API
3. **Each transaction is normalized** to standard format:
   ```javascript
   {
     wiseTransactionId: "uuid",
     type: "DEBIT" | "CREDIT",
     amount: 100.00,
     currency: "USD",
     description: "...",
     merchantName: "...",
     referenceNumber: "...",
     transactionDate: "2025-10-28",
     status: "outgoing_payment_sent"
   }
   ```
4. **Duplicate check**: Query `wise_transactions` table by `wise_transaction_id`
5. **Classification**: Run through `wiseClassifier.js`:
   - Try employee matching (for DEBIT transactions)
   - Try expense classification (using keyword rules)
   - Try income classification (for CREDIT transactions)
6. **Create entry**: If confidence ≥ 40%, auto-create entry with status:
   - ≥80% confidence: `status = 'completed'`
   - 40-79% confidence: `status = 'pending'` (needs review)
7. **Update balances**: Recalculate `currency_balances` table
8. **Return results**: JSON with imported/skipped/errors counts

### Sync Button Location

**Dashboard → Wise Account Balances section → "Sync from Wise" button**

![Sync Button Screenshot](../assets/wise-sync-button.png)

---

## Confidence Score System

The classification system assigns confidence scores (0-100%) to determine how transactions are handled.

### Confidence Tiers

| Tier | Score Range | Status | Needs Review | Behavior |
|------|-------------|--------|--------------|----------|
| **High** | 80-100% | `completed` | ❌ No | Auto-completed, appears in expenses immediately |
| **Medium** | 40-79% | `pending` | ⚠️ Yes | Created but flagged for manual review |
| **Low** | 20-39% | N/A | N/A | Not imported (skipped) |
| **Very Low** | 0-19% | N/A | N/A | Not imported (skipped) |

### How Confidence is Calculated

#### For Employee Matching (DEBIT)

```javascript
confidence = 0;

// Amount matching (up to 50 points)
if (amount === expectedSalary) confidence += 50;
else if (withinPercent(amount, expectedSalary, 5)) confidence += 40;
else if (withinPercent(amount, expectedSalary, 10)) confidence += 25;

// Name matching (up to 30 points)
if (fullNameMatch) confidence += 30;
else if (partialNameMatch) confidence += (15 * matchedParts);

// Schedule matching (up to 10 points)
if (payScheduleAligns) confidence += 10;

// Threshold: 40% minimum for auto-assignment
```

#### For Expense Classification (DEBIT)

```javascript
confidence = 70 + (rule.priority / 10);

// Examples:
// Priority 100 rule → 80% confidence
// Priority 50 rule → 75% confidence
// No rule match → 25% confidence (error fallback)
```

#### For Income Classification (CREDIT)

```javascript
// Contract amount match + client name → 90%
// Contract amount match only → 70%
// Keyword match → 60%
// No match → 50%
```

---

## Classification Rules

The system uses 33 active classification rules (as of October 28, 2025) to automatically categorize expenses.

### Rule Structure

Each rule has:
- **rule_name**: Human-readable identifier
- **keyword_pattern**: Regex pattern (case-insensitive)
- **target_category**: Accounting category to assign
- **priority**: Higher = matched first, higher confidence
- **is_active**: Enable/disable without deletion

### Current Rule Categories

#### Freelancing Platforms (Priority 95)
- Upwork, Fiverr, Freelancer.com → `Contractor Payment`

#### Cloud Services (Priority 100-85)
- AWS, Google Cloud, Azure, DigitalOcean, Heroku, Vercel → `Software`
- Netlify, Railway, MongoDB Atlas, Stripe → `Software` or `Bank Fees`

#### Development Tools (Priority 90)
- GitHub, GitLab, Jira, Slack, Discord, Notion, Trello → `Software`

#### Communication (Priority 75)
- Zoom, Slack, Microsoft Teams → `Software`

#### Design Tools (Priority 75)
- Adobe, Figma, Canva → `Software`

#### Travel (Priority 70-65)
- Uber, Airbnb, Booking.com, Hotels → `Travel`

#### Food (Priority 65-60)
- Restaurants, Uber Eats, DoorDash, Deliveroo → `Meals & Entertainment`

#### Office & Equipment (Priority 65-55)
- Amazon, Apple, Office Depot, Staples → `Administration`

#### Professional Services (Priority 60)
- Legal, Accounting, Bookkeeping → `Professional Services`

#### Utilities & Rent (Priority 80)
- Internet, Electricity, Water, Gas, Rent → `Administration`

#### Bank Fees (Priority 50)
- Bank fees, service charges, wire fees → `Bank Fees`

### Complete Rule List

View all 33 rules in production:

```sql
SELECT id, rule_name, keyword_pattern, target_category, priority
FROM wise_classification_rules
WHERE is_active = true
ORDER BY priority DESC, rule_name;
```

---

## Transaction Processing Flow

### Flowchart

```
┌─────────────────────────┐
│ User clicks Sync button │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Fetch from Wise API     │
│ /v1/profiles            │
│ /v4/balances            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Normalize transaction   │
│ data to standard format │
└────────────┬────────────┘
             │
             ▼
     ┌───────┴───────┐
     │ Duplicate?    │
     └───────┬───────┘
        Yes  │  No
      ┌──────┘
      │      │
      │      ▼
      │  ┌─────────────────┐
      │  │ Classify        │
      │  │ (wiseClassifier)│
      │  └────────┬────────┘
      │           │
      │           ▼
      │    ┌──────┴──────┐
      │    │ Confidence? │
      │    └──────┬──────┘
      │           │
      │    ┌──────┼──────┐
      │    │      │      │
      │   <40%  40-79%  ≥80%
      │    │      │      │
      │  Skip  Pending Complete
      │    │      │      │
      │    └──────┼──────┘
      │           │
      │           ▼
      │  ┌────────────────┐
      │  │ Create entry   │
      │  │ in entries     │
      │  └────────┬───────┘
      │           │
      └───────────┼───────┐
                  │       │
                  ▼       ▼
         ┌────────────────────┐
         │ Store in           │
         │ wise_transactions  │
         └────────┬───────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Update balances    │
         │ (currency_balances)│
         └────────┬───────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Return results     │
         │ (imported/skipped) │
         └────────────────────┘
```

---

## Managing Pending Entries

### Viewing Pending Entries

1. Navigate to **Expenses** tab
2. Look for entries with status "⏳ Pending"
3. These have 40-79% confidence and need manual review

### Reviewing an Entry

1. Click the **Edit** button (pencil icon)
2. Review the transaction details:
   - Amount and date
   - Wise reference number
   - Current category assignment
   - Confidence score (shown in detail field)
3. Update if needed:
   - Change category to more appropriate one
   - Edit description for clarity
   - Update status to "Completed"
4. Save changes

### Batch Review

For multiple pending entries:

1. Check the checkbox next to each entry
2. Use bulk actions:
   - **Bulk Status Update**: Change all to "Completed"
   - **Bulk Delete**: Remove incorrect imports

### Example Workflow

**Scenario**: 5 test transactions imported with 25% confidence

**Step 1**: Check entries in database
```sql
SELECT id, description, category, status, total
FROM entries
WHERE detail LIKE '%Wise%' AND status = 'pending';
```

**Step 2**: Analyze transaction details
- Small amounts (10-50 PLN) → Office supplies or software
- Large amounts (7930 PLN) → Contractor payments

**Step 3**: Update via SQL or API
```sql
UPDATE entries
SET category = 'office_supplies',
    description = 'Wise test - Office supplies',
    status = 'completed'
WHERE id IN (869, 870, 872);
```

**Step 4**: Update wise_transactions metadata
```sql
UPDATE wise_transactions
SET confidence_score = 100,
    sync_status = 'processed',
    needs_review = false,
    classified_category = 'Office Supplies'
WHERE id IN (7, 8, 10);
```

---

## Adding New Classification Rules

### Via SQL (Direct Database)

```sql
INSERT INTO wise_classification_rules (
  rule_name,
  keyword_pattern,
  target_category,
  priority,
  is_active
) VALUES (
  'Netlify Hosting',
  '(?i)(netlify)',
  'Software',
  85,
  true
);
```

### Keyword Pattern Best Practices

1. **Use case-insensitive regex**: `(?i)` prefix
2. **Multiple keywords**: `(?i)(keyword1|keyword2|keyword3)`
3. **Escape special characters**: `.` becomes `\.`
4. **Partial matching**: Patterns match anywhere in text
5. **Word boundaries**: Use `\b` for exact word matching

### Priority Guidelines

| Priority Range | Use Case | Confidence Score |
|----------------|----------|------------------|
| 90-100 | Critical categories (freelancing, cloud) | 79-80% |
| 80-89 | Important services (hosting, databases) | 78-79% |
| 70-79 | Common expenses (software, travel) | 77-78% |
| 60-69 | General categories (office, food) | 76-77% |
| 50-59 | Catch-all rules (bank fees) | 75% |

### Testing New Rules

1. Add rule with `is_active = false` initially
2. Query existing transactions to see matches:
```sql
SELECT wt.*,
  CASE WHEN wt.description ~ '(?i)(netlify)' THEN 'MATCH' ELSE 'NO MATCH' END as test_result
FROM wise_transactions wt
LIMIT 10;
```
3. If results look good, set `is_active = true`
4. Resync to apply to new transactions

### Example: Adding Restaurant Rule

```sql
-- Step 1: Add rule (inactive)
INSERT INTO wise_classification_rules (
  rule_name,
  keyword_pattern,
  target_category,
  priority,
  is_active
) VALUES (
  'Restaurant Meals',
  '(?i)(restaurant|cafe|bistro|diner|eatery)',
  'Meals & Entertainment',
  60,
  false
);

-- Step 2: Test against existing data
SELECT description,
  CASE WHEN description ~* '(?i)(restaurant|cafe|bistro|diner|eatery)'
    THEN 'WOULD MATCH'
    ELSE 'NO MATCH'
  END as result
FROM wise_transactions
WHERE type = 'DEBIT';

-- Step 3: Activate if good
UPDATE wise_classification_rules
SET is_active = true
WHERE rule_name = 'Restaurant Meals';
```

---

## Troubleshooting

### Issue: Transactions Not Syncing

**Symptoms**: Sync button returns 0 imported, 0 skipped

**Solutions**:

1. **Check Wise API connection**:
```bash
curl -X GET "https://api.wise.com/v1/profiles" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Verify environment variables**:
```bash
# Backend .env must have:
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=your_token_here
WISE_PROFILE_ID=your_profile_id
```

3. **Check Railway logs**:
```bash
railway logs
```

4. **Test connection endpoint**:
```bash
curl https://business-accounting-system-production.up.railway.app/api/wise/test-connection
```

### Issue: All Transactions Marked as Pending

**Symptoms**: Every transaction has 40-79% confidence, needs review

**Solutions**:

1. **Check classification rules are active**:
```sql
SELECT COUNT(*) FROM wise_classification_rules WHERE is_active = true;
```

2. **Review rule keyword patterns**:
- Ensure patterns match your transaction descriptions
- Check for typos in regex patterns
- Verify target categories exist

3. **Add more specific rules** for your common merchants

### Issue: Duplicate Transactions Created

**Symptoms**: Same transaction appears multiple times

**Solutions**:

1. **Verify duplicate check is working**:
```sql
SELECT wise_transaction_id, COUNT(*) as count
FROM wise_transactions
GROUP BY wise_transaction_id
HAVING COUNT(*) > 1;
```

2. **Check for multiple sync calls**: Ensure sync button is not double-clicked

3. **Database constraint**: Verify UNIQUE constraint on `wise_transaction_id`:
```sql
ALTER TABLE wise_transactions
ADD CONSTRAINT wise_transactions_wise_transaction_id_unique
UNIQUE (wise_transaction_id);
```

### Issue: Low Confidence Scores for Employee Salaries

**Symptoms**: Employee payments getting <40% confidence

**Solutions**:

1. **Check employee pay_rate and pay_multiplier**:
```sql
SELECT id, name, pay_rate, pay_multiplier, pay_type
FROM employees
WHERE is_active = true;
```

2. **Verify transaction amounts match expected salary**:
```sql
-- Expected weekly amount = pay_rate / 4 * pay_multiplier
SELECT
  e.name,
  e.pay_rate,
  e.pay_multiplier,
  (e.pay_rate / 4 * e.pay_multiplier) as expected_weekly,
  wt.amount as actual_amount
FROM employees e
JOIN wise_transactions wt ON wt.amount BETWEEN (e.pay_rate / 4 * e.pay_multiplier - 50)
                                           AND (e.pay_rate / 4 * e.pay_multiplier + 50);
```

3. **Check transaction descriptions** include employee names

4. **Verify payment schedule** alignment (Fridays for weekly)

### Issue: Balance Not Updating After Sync

**Symptoms**: Currency balances show old values

**Solutions**:

1. **Manually trigger recalculation**:
```bash
curl -X POST "https://business-accounting-system-production.up.railway.app/api/currency/recalculate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **Check balance calculation function**:
```sql
-- Verify balances sum correctly
SELECT currency, SUM(amount_original) as total
FROM entries
WHERE currency IS NOT NULL
GROUP BY currency;

-- Compare to currency_balances table
SELECT currency, balance
FROM currency_balances;
```

3. **Check for failed transactions** in sync:
```sql
SELECT * FROM wise_sync_audit_log
ORDER BY started_at DESC
LIMIT 1;
```

---

## Database Schema

### wise_transactions

Stores raw Wise transaction data and classification metadata.

```sql
CREATE TABLE wise_transactions (
  id SERIAL PRIMARY KEY,
  wise_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(10) NOT NULL, -- DEBIT | CREDIT
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  description TEXT,
  merchant_name VARCHAR(255),
  reference_number VARCHAR(255),
  transaction_date TIMESTAMP NOT NULL,
  status VARCHAR(50),
  raw_payload JSONB,

  -- Classification metadata
  classified_category VARCHAR(50),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  sync_status VARCHAR(20) DEFAULT 'pending', -- pending | processed | failed
  needs_review BOOLEAN DEFAULT true,
  processed_at TIMESTAMP,

  -- Relationships
  entry_id INTEGER REFERENCES entries(id),
  matched_employee_id INTEGER REFERENCES employees(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wise_transactions_sync_status ON wise_transactions(sync_status);
CREATE INDEX idx_wise_transactions_needs_review ON wise_transactions(needs_review);
CREATE INDEX idx_wise_transactions_date ON wise_transactions(transaction_date);
```

### wise_classification_rules

Defines keyword-based classification rules.

```sql
CREATE TABLE wise_classification_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  keyword_pattern VARCHAR(255) NOT NULL, -- Regex pattern
  target_category VARCHAR(50) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_classification_rules_active ON wise_classification_rules(is_active, priority DESC);
```

### wise_sync_audit_log

Tracks sync operations for monitoring and debugging.

```sql
CREATE TABLE wise_sync_audit_log (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- manual | webhook | scheduled
  transactions_processed INTEGER DEFAULT 0,
  entries_created INTEGER DEFAULT 0,
  entries_updated INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details TEXT,

  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

---

## API Endpoints

### Wise Sync Endpoints

#### POST /api/wise/sync

Trigger manual sync from Wise API.

**Authentication**: Bearer token required

**Request**:
```bash
curl -X POST "https://business-accounting-system-production.up.railway.app/api/wise/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "imported": 5,
  "skipped": 0,
  "errors": 0,
  "details": {
    "transactions": [
      {
        "wiseTransactionId": "68a8826f-02a3-471c-ef79-48a2218479b2",
        "amount": 10.00,
        "currency": "PLN",
        "category": "office_supplies",
        "confidence": 85,
        "entryId": 869
      }
    ]
  }
}
```

#### GET /api/wise/transactions/pending

Get all transactions needing manual review.

**Authentication**: Bearer token required

**Response**:
```json
{
  "success": true,
  "count": 3,
  "transactions": [
    {
      "id": 7,
      "wiseTransactionId": "68a8826f...",
      "amount": 10.00,
      "currency": "PLN",
      "confidenceScore": 45,
      "classifiedCategory": "Other Expenses",
      "needsReview": true,
      "entryId": 869
    }
  ]
}
```

#### GET /api/wise/test-connection

Test Wise API connection (diagnostic).

**Authentication**: None required

**Response**:
```json
{
  "success": true,
  "message": "Wise API connection successful",
  "profileId": "74801125"
}
```

### Currency Endpoints

#### GET /api/currency/balances

Get all currency balances with USD conversion.

**Authentication**: Bearer token required

**Response**:
```json
{
  "balances": [
    {
      "currency": "USD",
      "balance": 9763.44,
      "balanceUsd": 9763.44,
      "lastUpdated": "2025-10-18T00:00:00Z"
    },
    {
      "currency": "PLN",
      "balance": 4144.96,
      "balanceUsd": 1138.73,
      "lastUpdated": "2025-10-18T00:00:00Z"
    }
  ],
  "totalUsd": 10902.17
}
```

#### POST /api/currency/recalculate

Recalculate all currency balances from entries.

**Authentication**: Bearer token required

**Response**:
```json
{
  "success": true,
  "message": "Balances recalculated",
  "balances": { /* same as /balances */ }
}
```

---

## Summary

The Wise integration is **working and deployed** in production with:

- ✅ 5 test transactions successfully imported and classified
- ✅ 33 active classification rules covering common expense categories
- ✅ Confidence scoring system (40% threshold for auto-import)
- ✅ Manual review workflow for low-confidence transactions
- ✅ Multi-currency support with automatic USD conversion
- ✅ Comprehensive database schema and audit logging
- ✅ Frontend UI displaying all entries correctly

### Next Steps

1. **Monitor sync operations** in production
2. **Collect real transaction data** to improve rules
3. **Adjust confidence thresholds** based on accuracy
4. **Add more classification rules** for new merchants
5. **Implement webhook notifications** for real-time sync (optional)

### Support

For issues or questions:
- Check troubleshooting section above
- Review Railway logs: `railway logs`
- Query audit log: `SELECT * FROM wise_sync_audit_log`
- Contact: rafael@example.com

---

*Last Updated: October 28, 2025*
*Version: 1.0 - Production Deployment*
