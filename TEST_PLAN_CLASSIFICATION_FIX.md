# Test Plan: Wise Transaction Classification Fix

**Fix Commit**: a2a2276
**Date**: October 29, 2025

---

## Quick Test (5 minutes)

### Step 1: Clean Test Data
```bash
cd /Users/rafael/Windsurf/accounting/backend
psql -U accounting_user -d accounting_db -c "DELETE FROM entries WHERE wise_transaction_id IS NOT NULL; DELETE FROM wise_transactions;"
```

### Step 2: Run Sync Test
```bash
node scripts/test-wise-complete-sync.js
```

**Expected Output**:
```
✅ Successfully synced 9 transactions
- EUR transactions: 9
- Duplicates skipped: 0
- Errors: 0
```

### Step 3: Verify Classification
```bash
psql -U accounting_user -d accounting_db
```

```sql
-- Check type distribution
SELECT type, COUNT(*) as count
FROM entries
WHERE wise_transaction_id IS NOT NULL
GROUP BY type;
```

**Expected Result**:
```
   type   | count
----------+-------
 expense  |     9
```

(All current transactions are expenses - this is correct)

### Step 4: Verify Descriptions
```sql
-- Check descriptions contain direction phrases
SELECT
  e.type,
  w.merchant_name,
  w.raw_payload::json->>'description' as description
FROM entries e
JOIN wise_transactions w ON e.wise_transaction_id = w.wise_transaction_id
ORDER BY w.amount DESC
LIMIT 5;
```

**Expected Result**:
- All `description` fields should contain: "By you", "Spent by you", or "Sent by you"
- All `type` should be 'expense'

---

## Detailed Verification (10 minutes)

### Test 1: All Transactions Synced
```sql
-- Count should be 9
SELECT COUNT(*) as total_transactions
FROM wise_transactions;
```

**Expected**: 9 transactions

### Test 2: All Entries Created
```sql
-- Count should be 9
SELECT COUNT(*) as total_entries
FROM entries
WHERE wise_transaction_id IS NOT NULL;
```

**Expected**: 9 entries

### Test 3: All Amounts Correct
```sql
-- Verify amounts match Wise data
SELECT
  w.merchant_name,
  w.amount as wise_amount,
  w.currency as wise_currency,
  e.total as entry_amount,
  e.currency as entry_currency
FROM wise_transactions w
JOIN entries e ON e.wise_transaction_id = w.wise_transaction_id
ORDER BY w.amount DESC;
```

**Expected**: All amounts should match (wise_amount = entry_amount)

### Test 4: Classification Logic Working
```sql
-- Verify all have "by you" in description
SELECT
  raw_payload::json->>'description' as description,
  CASE
    WHEN LOWER(raw_payload::json->>'description') LIKE '%by you%' THEN '✅ Expense pattern'
    WHEN LOWER(raw_payload::json->>'description') LIKE '%to you%' THEN '✅ Income pattern'
    ELSE '❌ No pattern found'
  END as classification
FROM wise_transactions;
```

**Expected**: All should show "✅ Expense pattern"

### Test 5: Entry Types Match Logic
```sql
-- Verify expense entries have "by you" descriptions
SELECT
  e.type,
  w.raw_payload::json->>'description' as description,
  CASE
    WHEN e.type = 'expense' AND LOWER(w.raw_payload::json->>'description') LIKE '%by you%' THEN '✅ Correct'
    WHEN e.type = 'income' AND LOWER(w.raw_payload::json->>'description') LIKE '%to you%' THEN '✅ Correct'
    ELSE '❌ Mismatch'
  END as validation
FROM entries e
JOIN wise_transactions w ON e.wise_transaction_id = w.wise_transaction_id;
```

**Expected**: All should show "✅ Correct"

---

## Future Income Test (When Available)

When income transactions appear in Wise:

### Expected Income Patterns
```
"To you"
"Received"
"From [source name]"
```

### Verification Query
```sql
-- Check income transactions
SELECT
  e.type,
  w.merchant_name,
  w.raw_payload::json->>'description' as description
FROM entries e
JOIN wise_transactions w ON e.wise_transaction_id = w.wise_transaction_id
WHERE e.type = 'income';
```

**Expected**:
- `description` should contain income patterns ("to you", etc.)
- `type` should be 'income'

---

## Edge Case Testing

### Test: Missing Description
```sql
-- Check default behavior when description is null/empty
SELECT
  e.type,
  COALESCE(w.raw_payload::json->>'description', '[EMPTY]') as description
FROM entries e
JOIN wise_transactions w ON e.wise_transaction_id = w.wise_transaction_id
WHERE w.raw_payload::json->>'description' IS NULL OR w.raw_payload::json->>'description' = '';
```

**Expected**: Should default to 'expense' (DEBIT)

### Test: Case Sensitivity
```sql
-- Verify lowercase conversion works
SELECT
  raw_payload::json->>'description' as original,
  LOWER(raw_payload::json->>'description') as lowercase,
  CASE
    WHEN LOWER(raw_payload::json->>'description') LIKE '%by you%' THEN 'Matched'
    ELSE 'Not matched'
  END as result
FROM wise_transactions;
```

**Expected**: All should show "Matched" with proper lowercase handling

---

## Success Criteria

✅ **Pass if ALL conditions met**:

1. **9 transactions synced** from Wise API
2. **9 entries created** in database
3. **All classified as expenses** (correct for current timeframe)
4. **All descriptions contain "by you"** or similar expense phrases
5. **No errors** in sync process
6. **Amounts match** between wise_transactions and entries tables

❌ **Fail if ANY condition fails**:

1. Wrong number of transactions
2. Incorrect type classification
3. Missing entries
4. Amount mismatches
5. Sync errors

---

## Rollback Plan (If Test Fails)

If the fix doesn't work:

### Step 1: Revert Commit
```bash
cd /Users/rafael/Windsurf/accounting
git revert a2a2276
```

### Step 2: Document Issue
- Update bug report with failure details
- Include test results
- Add error messages

### Step 3: Re-analyze
- Check actual API response structure
- Verify description field content
- Review classification logic

---

## Performance Check

### Expected Timing
```
Sync 9 transactions: < 5 seconds
Database inserts: < 1 second
Total test time: < 10 seconds
```

### Memory Usage
```
Node process: < 100 MB
Database connections: 1-2 active
```

---

## Monitoring After Deployment

### Daily Checks (First Week)
```sql
-- Check classification distribution
SELECT
  type,
  COUNT(*) as count,
  SUM(total) as total_amount
FROM entries
WHERE wise_transaction_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY type;
```

### Weekly Review
```sql
-- Verify no misclassifications
SELECT
  e.type,
  COUNT(*) as count,
  STRING_AGG(DISTINCT w.raw_payload::json->>'description', ', ') as descriptions
FROM entries e
JOIN wise_transactions w ON e.wise_transaction_id = w.wise_transaction_id
WHERE e.created_at > NOW() - INTERVAL '7 days'
GROUP BY e.type;
```

---

**Test Prepared By**: Claude Code
**Ready For**: Production testing
**Estimated Test Time**: 5-10 minutes
