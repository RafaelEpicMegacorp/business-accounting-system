# Wise Sync History Feature - Test Plan

## Feature Summary
Added "Sync Wise History" button to dashboard with enhanced per-currency breakdown in success messages.

## Pre-Test Setup

### 1. Start Application
```bash
cd /Users/rafael/Windsurf/accounting

# Start backend (Terminal 1)
cd backend
npm run dev

# Start frontend (Terminal 2)
cd frontend
npm run dev
```

### 2. Verify Environment Variables
Backend `.env` must contain:
```bash
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=10b1f19c-bd61-4c9b-8d86-1ec264550ad4
WISE_PROFILE_ID=74801125
```

### 3. Login Credentials
- **Username**: `rafael`
- **Password**: `asdflkj@3!`

### 4. Access Points
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Test Cases

### ✅ Test Case 1: Button Appearance and Placement
**Objective**: Verify button is correctly placed and styled

**Steps**:
1. Open http://localhost:5173
2. Login with credentials
3. Scroll to "Wise Account Balances" section
4. Locate "Sync Wise History" button

**Expected Results**:
- [ ] Button appears next to "Import CSV" button
- [ ] Button has blue background (bg-blue-600)
- [ ] Button text reads "Sync Wise History" (not "Sync from Wise")
- [ ] Button has RefreshCw icon (rotating arrows)
- [ ] Button has shadow and rounded corners
- [ ] Button width auto-adjusts to text

**Screenshot Required**: Yes - Show button in context

---

### ✅ Test Case 2: Sync with New Transactions
**Objective**: Test sync with new Wise transactions

**Steps**:
1. Ensure database has no recent Wise transactions (or use fresh test account)
2. Click "Sync Wise History" button
3. Observe loading state
4. Wait for completion
5. Read success message

**Expected Results - Loading State**:
- [ ] Button text changes to "Syncing..."
- [ ] RefreshCw icon rotates (animate-spin class)
- [ ] Button is disabled (opacity-50, cursor-not-allowed)
- [ ] Button background remains blue
- [ ] Cannot click button again during sync

**Expected Results - Success Message**:
- [ ] Success message appears in green box
- [ ] Message starts with "✅ Wise Sync Complete"
- [ ] Shows per-currency breakdown with flags:
  - 🇺🇸 USD: X new transactions (XXX.XX USD)
  - 🇪🇺 EUR: X new transactions (XXX.XX EUR)
  - 🇵🇱 PLN: X new transactions (XXX.XX PLN)
- [ ] Shows total: "Total: X transactions imported"
- [ ] Message uses monospace font
- [ ] Message is multiline formatted
- [ ] Only currencies with new transactions are shown

**Expected Results - Dashboard Refresh**:
- [ ] Currency balance cards update automatically
- [ ] Total USD balance recalculates
- [ ] Income vs Expense chart refreshes
- [ ] Category breakdown chart refreshes

**Expected Results - Cleanup**:
- [ ] Success message auto-dismisses after 15 seconds
- [ ] Button returns to "Sync Wise History" text
- [ ] Button re-enables
- [ ] Icon stops spinning

**Backend Verification**:
```bash
# Check backend logs for sync details
# Should show:
# - Balances processed count
# - Transactions found per currency
# - New transactions created
# - Entries inserted
```

**Database Verification**:
```sql
-- Check wise_transactions table
SELECT COUNT(*) FROM wise_transactions;

-- Check entries table
SELECT COUNT(*) FROM entries WHERE wise_transaction_id IS NOT NULL;

-- Check currency balances
SELECT * FROM currency_balances ORDER BY currency;
```

**Screenshot Required**: Yes - Show success message with breakdown

---

### ✅ Test Case 3: Sync with All Duplicates
**Objective**: Test sync when all transactions already exist

**Steps**:
1. Run sync once successfully (Test Case 2)
2. Immediately click "Sync Wise History" again
3. Observe response

**Expected Results**:
- [ ] Sync completes quickly (2-3 seconds)
- [ ] Success message shows:
  ```
  ✅ Wise Sync Complete
  All transactions up to date (X duplicates skipped)
  ```
- [ ] No new entries created
- [ ] Currency balances remain unchanged
- [ ] Dashboard does not show new data
- [ ] Message auto-dismisses after 15 seconds

**Backend Verification**:
```bash
# Check logs show:
# - "X duplicates skipped"
# - "0 new transactions"
# - "0 entries created"
```

**Screenshot Required**: Yes - Show "all duplicates" message

---

### ✅ Test Case 4: Error Handling - Backend Down
**Objective**: Test error handling when backend is unavailable

**Steps**:
1. Stop backend server (Ctrl+C in Terminal 1)
2. Click "Sync Wise History" button
3. Observe error handling

**Expected Results**:
- [ ] Button shows "Syncing..." briefly
- [ ] Red error message appears
- [ ] Error message includes connection error details
- [ ] Button re-enables for retry
- [ ] Error message auto-dismisses after 10 seconds
- [ ] Can retry after restarting backend

**Screenshot Required**: Yes - Show error message

---

### ✅ Test Case 5: Error Handling - Missing API Config
**Objective**: Test error when Wise API credentials are missing

**Steps**:
1. Stop backend
2. Remove `WISE_API_TOKEN` from backend `.env`
3. Restart backend
4. Click "Sync Wise History"
5. Observe error

**Expected Results**:
- [ ] Red error message appears
- [ ] Error text includes "Wise API not configured"
- [ ] Mentions "Missing WISE_API_TOKEN or WISE_PROFILE_ID"
- [ ] Button remains enabled
- [ ] Error auto-dismisses after 10 seconds

**Cleanup**:
```bash
# Restore WISE_API_TOKEN to .env
WISE_API_TOKEN=10b1f19c-bd61-4c9b-8d86-1ec264550ad4
# Restart backend
```

**Screenshot Required**: Yes - Show configuration error

---

### ✅ Test Case 6: Multiple Currency Sync
**Objective**: Verify sync handles multiple currencies correctly

**Steps**:
1. Ensure Wise account has transactions in USD, EUR, PLN
2. Clear wise_transactions table (optional, for fresh test)
3. Click "Sync Wise History"
4. Observe success message

**Expected Results**:
- [ ] All currencies with transactions are listed
- [ ] Correct flag for each currency
- [ ] Balance amounts are accurate
- [ ] Transaction counts are accurate
- [ ] Currencies without transactions are omitted
- [ ] Total count matches sum of all currencies

**SQL Verification**:
```sql
-- Verify transactions by currency
SELECT
  currency,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM wise_transactions
GROUP BY currency
ORDER BY currency;

-- Should match the success message breakdown
```

**Screenshot Required**: Yes - Show multi-currency breakdown

---

### ✅ Test Case 7: Loading State Validation
**Objective**: Ensure loading state prevents double-clicks

**Steps**:
1. Click "Sync Wise History"
2. Immediately try to click again during sync
3. Try clicking "Import CSV" during sync
4. Observe behavior

**Expected Results**:
- [ ] First click triggers sync
- [ ] Subsequent clicks on sync button do nothing (disabled)
- [ ] Can still click other buttons (Import CSV)
- [ ] Sync button cursor changes to "not-allowed"
- [ ] Button opacity reduces to 50%
- [ ] Icon continuously spins until complete

**Screenshot Required**: Yes - Show disabled state during sync

---

### ✅ Test Case 8: Long Running Sync (100+ Transactions)
**Objective**: Test sync with large transaction volume

**Steps**:
1. Use Wise account with 100+ historical transactions
2. Clear wise_transactions table
3. Click "Sync Wise History"
4. Monitor progress

**Expected Results**:
- [ ] Sync completes without timeout
- [ ] Button stays disabled entire time
- [ ] Backend logs show batch processing
- [ ] Success message appears after completion
- [ ] All transactions processed
- [ ] No database connection errors

**Backend Logs to Monitor**:
```bash
# Should show:
- Fetching activities in batches
- Processing X of Y transactions
- Currency breakdown statistics
- Total sync time
```

**Screenshot Required**: Yes - Show final success with high transaction count

---

### ✅ Test Case 9: Dashboard Auto-Refresh
**Objective**: Verify dashboard updates after sync

**Steps**:
1. Note current values:
   - Currency balances
   - Total USD balance
   - Chart data
2. Perform sync with new transactions
3. Compare values after sync

**Expected Results**:
- [ ] Currency balance cards update without page refresh
- [ ] Total Wise Balance card updates
- [ ] Income vs Expense chart adds new data points
- [ ] Category breakdown chart recalculates
- [ ] No page reload required
- [ ] Changes are immediate after success message

**Screenshot Required**: Yes - Before and after comparison

---

### ✅ Test Case 10: Message Readability
**Objective**: Ensure success message is easy to read

**Steps**:
1. Perform sync with multiple currencies
2. Read success message carefully
3. Evaluate formatting

**Expected Results**:
- [ ] Message uses monospace font (clear number alignment)
- [ ] Each currency on separate line
- [ ] Flags add visual distinction
- [ ] Numbers are properly formatted (thousands separators)
- [ ] Total line is separated by blank line
- [ ] Green background provides good contrast
- [ ] Text is not truncated
- [ ] 15 seconds is enough time to read

**Screenshot Required**: Yes - Show detailed message

---

## API Test (Backend Only)

### Direct API Test with curl
```bash
# Test sync endpoint directly
curl -X POST http://localhost:3001/api/wise/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Expected response structure:
{
  "success": true,
  "message": "Complete historical sync finished: X new transactions imported",
  "stats": {
    "balancesProcessed": 4,
    "transactionsFound": 9,
    "newTransactions": 0,
    "duplicatesSkipped": 9,
    "entriesCreated": 0,
    "errors": 0,
    "currencyBreakdown": {
      "USD": {
        "transactionsFound": 2,
        "newTransactions": 0,
        "duplicatesSkipped": 2,
        "entriesCreated": 0,
        "currentBalance": 33592.13
      }
    }
  }
}
```

---

## Performance Tests

### Performance Test 1: Sync Speed
**Criteria**:
- Small account (<10 transactions): Complete in < 5 seconds
- Medium account (10-100 transactions): Complete in < 15 seconds
- Large account (100+ transactions): Complete in < 60 seconds

**Measurement**:
- Note timestamp when clicking button
- Note timestamp when success message appears
- Calculate duration

### Performance Test 2: Database Impact
**Criteria**:
- No connection pool exhaustion
- No deadlocks
- No duplicate entries
- Proper transaction isolation

**Verification**:
```sql
-- Check for duplicates (should be 0)
SELECT wise_transaction_id, COUNT(*)
FROM wise_transactions
GROUP BY wise_transaction_id
HAVING COUNT(*) > 1;

-- Check entries have transaction links
SELECT COUNT(*)
FROM entries
WHERE wise_transaction_id IS NOT NULL
AND wise_transaction_id NOT IN (SELECT wise_transaction_id FROM wise_transactions);
```

---

## Cross-Browser Testing

### Browsers to Test
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Verification for Each**:
- [ ] Button displays correctly
- [ ] Loading animation works
- [ ] Success message formats properly
- [ ] Multiline text displays correctly
- [ ] Auto-dismiss timer works

---

## Regression Tests

### Verify Other Features Still Work
- [ ] "Import CSV" button still functional
- [ ] Dashboard loads without errors
- [ ] Currency balance cards display
- [ ] Charts render correctly
- [ ] Other dashboard features unaffected
- [ ] Navigation works properly

---

## Test Results Summary

### Test Execution Date
Date: _______________

### Tester Name
Name: _______________

### Test Results Table

| Test Case | Status | Notes | Screenshot |
|-----------|--------|-------|-----------|
| TC1: Button Appearance | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC2: Sync with New | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC3: All Duplicates | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC4: Backend Down | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC5: Missing Config | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC6: Multi-Currency | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC7: Loading State | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC8: Long Sync | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC9: Auto-Refresh | ⬜ PASS ⬜ FAIL | | ⬜ Attached |
| TC10: Readability | ⬜ PASS ⬜ FAIL | | ⬜ Attached |

### Overall Assessment
- [ ] Feature is ready for production
- [ ] Feature needs minor fixes
- [ ] Feature needs major rework

### Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Recommendations
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Sign-Off

**Developer**: Claude Code (Feature Implementation Complete)
**Date**: October 29, 2025

**QA Tester**: _______________
**Date**: _______________

**Product Owner**: _______________
**Date**: _______________

---

## Appendix: Quick Reference

### File Locations
- **Frontend Component**: `frontend/src/components/DashboardView.jsx`
- **Backend Endpoint**: `backend/src/routes/wiseSync_new.js`
- **API Service**: `frontend/src/services/wiseService.js`
- **Feature Documentation**: `WISE_SYNC_HISTORY_FEATURE.md`

### Key Code Changes
- Line 230: Button text updated to "Sync Wise History"
- Lines 53-113: Enhanced handleWiseSync function
- Line 245: Multiline message styling

### API Endpoint
- **URL**: `POST /api/wise/sync`
- **Auth**: Required (JWT Bearer token)
- **Timeout**: 30 seconds default

### Environment Variables
```bash
# Required
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=10b1f19c-bd61-4c9b-8d86-1ec264550ad4
WISE_PROFILE_ID=74801125
```

---

**Document Version**: 1.0
**Last Updated**: October 29, 2025
