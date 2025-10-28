# Wise Balance Widget Fix - Complete Summary

**Date**: October 28, 2025
**Issue**: Dashboard showing outdated Wise balance data (from 10/18/2025)
**Status**: ✅ **FIXED**

---

## Problem Description

The dashboard "Wise Account Balances" widget was displaying stale data:
- **EUR**: -171.37 (Last updated: 10/18/2025)
- **PLN**: 117.54 (Last updated: 10/18/2025)
- **USD**: -312.48 (Last updated: 10/18/2025)

After clicking "Sync from Wise", the balances remained unchanged, showing 10-day-old data.

---

## Root Cause Analysis

### Initial Hypothesis (INCORRECT)
❌ **First thought**: The Wise sync endpoint doesn't update the `currency_balances` table after creating entries.

### Deeper Investigation Revealed
✅ **Actual root cause**: The `currency_balances` table is **intentionally designed** to track ONLY Wise-related entries (not all business transactions).

**Evidence**:
1. The `recalculate_currency_balances()` PostgreSQL function filters entries by:
   ```sql
   WHERE (detail LIKE '%Wise ID:%' OR detail LIKE '%Opening Balance%')
   ```

2. Migration 011 comment (line 2):
   > "This prevents employee salaries and other business expenses from affecting Wise account balances"

3. The table tracks **real Wise bank account balances**, not calculated business balances.

### The Real Problem
The Wise sync endpoint was:
- ✅ Creating entries correctly
- ✅ Storing transactions properly
- ❌ **NOT fetching real Wise account balances from API**

The `currency_balances` table showed:
- **Cached balances** from 10 days ago
- **Not actual Wise account balances** from the API

When we checked the **real** Wise API:
```bash
curl 'https://api.wise.com/v4/profiles/74801255/balances?types=STANDARD'
```

**Result**: All balances are **0.00** (EUR, PLN, USD all empty accounts)

---

## Solution Implemented

### Code Changes

**File**: `/backend/src/routes/wiseImport.js` (Lines 1642-1678)

**Added after transaction processing**:
```javascript
// Fetch and update real Wise account balances from API
console.log('🔄 Fetching real Wise account balances from API...');
try {
  const balancesResponse = await fetch(
    `${WISE_API_URL}/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (balancesResponse.ok) {
    const balances = await balancesResponse.json();

    // Update currency_balances table with real Wise balances
    for (const balance of balances) {
      await pool.query(`
        INSERT INTO currency_balances (currency, balance, last_updated)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (currency)
        DO UPDATE SET balance = $2, last_updated = CURRENT_TIMESTAMP
      `, [balance.currency, balance.amount.value]);

      console.log(`✓ Updated ${balance.currency}: ${balance.amount.value}`);
    }

    console.log('✅ Real Wise account balances synced');
  } else {
    console.warn('⚠️  Failed to fetch Wise balances:', balancesResponse.status);
  }
} catch (error) {
  console.error('❌ Error fetching Wise balances:', error.message);
  // Don't fail the entire sync if balance fetch fails
}
```

### What This Does

1. **After** processing all Wise transactions
2. **Fetches** real account balances from Wise API (`GET /v4/profiles/{profileId}/balances`)
3. **Updates** `currency_balances` table with actual bank account balances
4. **Sets** `last_updated` timestamp to current time
5. **Logs** each currency balance update
6. **Graceful error handling** - doesn't fail sync if balance fetch fails

---

## Testing Results

### Before Fix
```
Currency | Balance   | Last Updated
---------|-----------|---------------------------
EUR      | -171.37   | 2025-10-18 11:54:52.602874
PLN      | 117.54    | 2025-10-18 11:54:52.602874
USD      | -312.48   | 2025-10-18 11:54:52.602874
```

### After Fix
```
Currency | Balance | Last Updated
---------|---------|---------------------------
EUR      | 0.00    | 2025-10-28 16:39:34.546Z
PLN      | 0.00    | 2025-10-28 16:39:34.552Z
USD      | 0.00    | 2025-10-28 16:39:34.553Z
```

### API Endpoint Verification
```bash
# Test balance fetch
curl http://localhost:3001/api/currency/balances

# Result: Current balances with today's timestamp ✅

# Test total USD balance
curl http://localhost:3001/api/currency/total-usd

# Result: total_usd: 0, rates_updated: 2025-10-28 ✅
```

---

## What Changed

| Aspect | Before | After |
|--------|--------|-------|
| **Balance Source** | Cached (10 days old) | Real-time from Wise API |
| **After Sync** | Balances unchanged | Balances updated automatically |
| **Dashboard Display** | Stale data | Current actual balances |
| **Last Updated** | 10/18/2025 | Current timestamp |
| **Accuracy** | Incorrect (-$312 USD) | Correct ($0.00 USD) |

---

## Key Learnings

### 1. Multi-Purpose Tables Can Be Confusing
The `currency_balances` table serves TWO purposes:
- **Wise Account Tracking**: Real bank balances (this fix)
- **Business Accounting**: Calculated from entries (separate concern)

**Recommendation**: Consider splitting into two tables:
- `wise_account_balances` - Real Wise API balances
- `business_currency_balances` - Calculated from all entries

### 2. Cache Invalidation is Critical
When displaying "real-time" data, ensure cache is refreshed after sync operations.

### 3. API as Source of Truth
For external service data (like Wise), the API should be the primary source, not calculations.

---

## Deployment Checklist

- [x] Code changes implemented in `/backend/src/routes/wiseImport.js`
- [x] Tested locally with real Wise API
- [x] Verified balances update correctly
- [x] Dashboard displays current data
- [x] Error handling added (graceful failure)
- [ ] Deploy to production
- [ ] Test in production environment
- [ ] Monitor for any issues

---

## Future Improvements

### 1. Add Dedicated Balance Refresh Button
```javascript
// New endpoint: POST /api/wise/refresh-balances
// Allows manual balance refresh without full sync
```

### 2. Add Balance Update Logging
```sql
CREATE TABLE wise_balance_history (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(3),
  old_balance DECIMAL(15, 2),
  new_balance DECIMAL(15, 2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Add Health Check
```javascript
// Alert if last_updated > 24 hours old
// Shows warning in dashboard
```

### 4. Show Sync Status in UI
```javascript
// Dashboard indicator:
// "Last synced: 5 minutes ago ✓"
// "Last synced: 2 days ago ⚠️"
```

---

## Files Modified

| File | Lines | Change Description |
|------|-------|-------------------|
| `/backend/src/routes/wiseImport.js` | 1642-1678 | Added Wise balance fetch after sync |

**Total Changes**: 37 lines added (1 file modified)

---

## Verification Commands

### Check Current Balances
```bash
# Via API
curl http://localhost:3001/api/currency/balances

# Via Database
psql -U accounting_user -d accounting_db \
  -c "SELECT currency, balance, last_updated FROM currency_balances;"
```

### Test Balance Fetch
```bash
# Direct Wise API call
curl 'https://api.wise.com/v4/profiles/74801255/balances?types=STANDARD' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### Trigger Sync (Requires Auth)
```bash
# Get JWT token first
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rafael","password":"YOUR_PASSWORD"}' \
  | jq -r '.token')

# Trigger sync
curl -X POST http://localhost:3001/api/wise/sync \
  -H "Authorization: Bearer $TOKEN"
```

---

## Conclusion

**Problem**: Dashboard showed outdated cached Wise balances
**Root Cause**: Sync didn't fetch real balances from Wise API
**Solution**: Added balance fetch to sync endpoint
**Result**: Dashboard now shows accurate, current Wise account balances
**Impact**: HIGH - Users now see real account state, not stale cache
**Risk**: LOW - Graceful error handling, doesn't break sync if fetch fails

The fix is **complete**, **tested**, and **ready for production deployment**.

---

## Related Documentation

- **Root Cause Analysis**: `/Users/rafael/Windsurf/accounting/ROOT_CAUSE_ANALYSIS_BALANCE_WIDGET.md`
- **Wise API Reference**: `/Users/rafael/Windsurf/accounting/DOCS/API/WISE_API_REFERENCE.md`
- **Migration 011**: `/Users/rafael/Windsurf/accounting/backend/migrations/011_fix_currency_balance_calculation.sql`
- **Currency Model**: `/Users/rafael/Windsurf/accounting/backend/src/models/currencyModel.js`

---

*Fix implemented by: Claude Code (Feature Supervisor Agent)*
*Date: October 28, 2025*
*Status: ✅ Completed and Tested*
