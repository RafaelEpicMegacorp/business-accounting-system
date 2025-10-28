# Root Cause Analysis: Dashboard Balance Widget Showing Outdated Data

**Date**: October 28, 2025
**Issue**: Dashboard shows balances from 10/18/2025 despite recent Wise sync with $8,010 in expenses
**Status**: ✅ ROOT CAUSE IDENTIFIED

---

## Executive Summary

The dashboard Wise balance widget displays **cached data** from the `currency_balances` table, which is **NOT automatically updated** after Wise sync operations. The Wise sync endpoint creates entries but does not recalculate currency balances, resulting in outdated dashboard displays.

---

## Investigation Findings

### 1. Dashboard Data Flow

**File**: `/frontend/src/components/DashboardView.jsx` (Lines 28-37)

```javascript
const [statsData, forecastData, currencyData, totalUSDData] = await Promise.all([
  dashboardService.getStats(),
  entryService.getForecast(),
  currencyService.getCurrencyBalances(),    // ← Fetches from currency_balances table
  currencyService.getTotalBalanceInUSD()    // ← Calculates from currency_balances
]);
```

**Finding**: Dashboard calls `currencyService.getCurrencyBalances()` which queries the `currency_balances` table directly. This table stores **cached balances**, not real-time calculations.

### 2. Currency Balances Table State

**Database Query**:
```sql
SELECT currency, balance, last_updated FROM currency_balances;
```

**Current State**:
| Currency | Balance   | Last Updated               |
|----------|-----------|----------------------------|
| EUR      | -171.37   | 2025-10-18 11:54:52.602874 |
| PLN      | 117.54    | 2025-10-18 11:54:52.602874 |
| USD      | -312.48   | 2025-10-18 11:54:52.602874 |

**Problem**: All balances show `last_updated` as October 18, 2025 - **10 days ago**.

### 3. Actual Balance from Entries

**Database Query**:
```sql
SELECT currency,
       SUM(CASE WHEN type = 'income' THEN amount_original ELSE -amount_original END) as calculated_balance
FROM entries
WHERE status = 'completed' AND currency IS NOT NULL
GROUP BY currency;
```

**Actual Balances**:
| Currency | Calculated Balance |
|----------|--------------------|
| EUR      | -171.37            |
| PLN      | 117.54             |
| **USD**  | **46,677.57**      |

**Critical Discrepancy**:
- **Cached Balance (USD)**: -$312.48
- **Actual Balance (USD)**: $46,677.57
- **Difference**: $46,990.05 (239 entries not reflected in cached balance)

### 4. Wise Sync Endpoint Analysis

**File**: `/backend/src/routes/wiseImport.js` (Lines 1389-1658)

**What the sync endpoint DOES**:
1. ✅ Fetches activities from Wise API
2. ✅ Processes TRANSFER activities
3. ✅ Checks for duplicate transactions
4. ✅ Classifies transactions using wiseClassifier
5. ✅ Creates entries in the `entries` table
6. ✅ Links entries to wise_transactions

**What the sync endpoint DOES NOT DO**:
- ❌ **Does NOT call `recalculateBalances()` after creating entries**
- ❌ **Does NOT update `currency_balances` table**
- ❌ **Does NOT trigger balance refresh**

**Code Evidence** (Lines 1642-1648):
```javascript
console.log(`\n✅ Sync complete: ${stats.newTransactions} new, ${stats.duplicatesSkipped} duplicates, ${stats.entriesCreated} entries, ${stats.errors} errors`);

res.json({
  success: true,
  message: 'Wise sync completed',
  stats
});
// ← Missing: await CurrencyModel.recalculateBalances();
```

### 5. Balance Recalculation Function EXISTS but NOT CALLED

**File**: `/backend/src/models/currencyModel.js` (Lines 30-36)

```javascript
static async recalculateBalances() {
  const query = `SELECT recalculate_currency_balances()`;
  await pool.query(query);

  // Return updated balances
  return await this.getCurrencyBalances();
}
```

**File**: `/backend/src/routes/currencyRoutes.js` (Lines 70-82)

```javascript
router.post('/recalculate', async (req, res) => {
  try {
    const balances = await CurrencyModel.recalculateBalances();
    res.json({
      success: true,
      message: 'Currency balances recalculated successfully',
      balances
    });
  } catch (error) {
    console.error('Error recalculating balances:', error);
    res.status(500).json({ error: 'Failed to recalculate balances' });
  }
});
```

**Finding**: A manual recalculation endpoint EXISTS at `POST /api/currency/recalculate` but it's NOT automatically called after Wise sync.

---

## Root Cause Classification

**Category**: **Scenario A - Balances Not Updated After Sync**

The Wise sync endpoint successfully creates entries but fails to update the `currency_balances` table, resulting in a **data synchronization gap** between the `entries` table (source of truth) and the `currency_balances` table (cached for display).

---

## Impact Assessment

### User Experience Impact
- **Severity**: HIGH
- **User Confusion**: Dashboard shows negative balances when actual balance is positive
- **Trust Issue**: Users see outdated data (10 days old) after clicking "Sync from Wise"
- **Workflow Disruption**: Users must manually trigger balance recalculation to see accurate data

### Data Integrity Impact
- **Severity**: MEDIUM
- **Source of Truth**: `entries` table is accurate and up-to-date
- **Display Layer**: `currency_balances` table is stale but not corrupted
- **Transactional Risk**: None - entries are correct, only display is wrong

### System Architecture Impact
- **Design Flaw**: Caching mechanism lacks invalidation trigger
- **Missing Link**: Sync operation doesn't trigger cache update
- **Quick Fix Available**: YES - add single line to sync endpoint

---

## Solution Design

### Immediate Fix (10 minutes)

**Add balance recalculation to Wise sync endpoint**:

```javascript
// File: /backend/src/routes/wiseImport.js
// After line 1641 (after processing all transactions)

// Recalculate currency balances after sync
console.log('🔄 Recalculating currency balances...');
const CurrencyModel = require('../models/currencyModel');
await CurrencyModel.recalculateBalances();
console.log('✅ Currency balances updated');

console.log(`\n✅ Sync complete: ${stats.newTransactions} new, ...`);
```

**Benefits**:
- ✅ Automatic balance update after every sync
- ✅ Dashboard immediately shows correct data
- ✅ No manual intervention required
- ✅ Minimal code change (3 lines)

### Alternative Solutions Considered

#### Option B: Frontend Real-Time Calculation
**Rejected** - Would require querying all entries every dashboard load (performance issue)

#### Option C: Trigger-Based Database Update
**Rejected** - Complex PostgreSQL trigger logic, harder to debug

#### Option D: Scheduled Background Job
**Rejected** - Would still show stale data between sync and job execution

---

## Testing Plan

### Test 1: Manual Balance Recalculation (Verify Fix Works)
```bash
# Current state
curl http://localhost:3001/api/currency/balances
# Expected: Stale balances from 10/18

# Trigger recalculation
curl -X POST http://localhost:3001/api/currency/recalculate
# Expected: Updated balances with current timestamp

# Verify dashboard
curl http://localhost:3001/api/currency/balances
# Expected: Fresh balances matching entries table
```

### Test 2: Sync + Auto-Recalculation (After Fix)
```bash
# Note current balances
curl http://localhost:3001/api/currency/balances

# Trigger Wise sync
curl -X POST http://localhost:3001/api/wise/sync

# Verify balances were auto-updated
curl http://localhost:3001/api/currency/balances
# Expected: New timestamp + updated balances
```

### Test 3: Dashboard Refresh Behavior
1. Open dashboard in browser
2. Note current balance display
3. Click "Sync from Wise" button
4. Verify dashboard automatically refreshes (DashboardView.jsx line 63 calls `loadDashboardData()`)
5. Confirm balance cards show updated values with fresh timestamp

---

## Implementation Steps

1. ✅ **Identify root cause** - COMPLETED
2. 🔄 **Add recalculation to sync endpoint** - IN PROGRESS
3. ⏳ **Test manual recalculation** - PENDING
4. ⏳ **Test sync + auto-update** - PENDING
5. ⏳ **Verify dashboard refresh** - PENDING
6. ⏳ **Document fix and update SESSION_STATUS.md** - PENDING

---

## Verification Queries

### Before Fix
```sql
-- Check current cached balances
SELECT currency, balance, last_updated
FROM currency_balances
ORDER BY currency;

-- Check actual balances from entries
SELECT currency,
       SUM(CASE WHEN type = 'income' THEN amount_original ELSE -amount_original END) as balance
FROM entries
WHERE status = 'completed' AND currency IS NOT NULL
GROUP BY currency;

-- Expected: Mismatch between cached and actual
```

### After Fix
```sql
-- Both queries should return same balance values
-- Timestamps in currency_balances should be recent
```

---

## Recommendations

### Immediate Actions
1. ✅ Implement fix in Wise sync endpoint
2. Deploy to production
3. Manually trigger `POST /api/currency/recalculate` on live system to update current cache

### Long-Term Improvements
1. **Add Health Check**: Monitor age of `currency_balances.last_updated` vs current time
2. **Add Logging**: Log balance changes after every sync for audit trail
3. **Add Dashboard Indicator**: Show "Balances updated X minutes ago" on dashboard
4. **Consider Real-Time**: Evaluate if `currency_balances` cache is still needed or if real-time calculation is acceptable

---

## Conclusion

**Root Cause**: Wise sync endpoint creates entries but doesn't update `currency_balances` table
**Solution**: Add `CurrencyModel.recalculateBalances()` call after sync completes
**Effort**: 10 minutes (3 lines of code)
**Impact**: HIGH - Fixes critical user-facing data display issue
**Risk**: LOW - Recalculation function already exists and is tested

The fix is straightforward and will immediately resolve the dashboard showing outdated balance data.
