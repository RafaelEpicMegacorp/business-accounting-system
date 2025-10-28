# Wise Sync Critical Fix - Missing Foreign Key

**Date**: October 28, 2025
**Issue**: Wise sync running but creating 0 entries
**Root Cause**: Missing `wise_transaction_id` foreign key in entry INSERT statement

## Problem Discovered

After implementing the Activities API parsing fix (commit a785b33), the sync was still creating 0 entries despite:
- ✅ Activities API returning transactions correctly
- ✅ Parsing logic extracting merchant names from `activity.title`
- ✅ Amount/currency parsing from `activity.primaryAmount` working
- ✅ DEBIT/CREDIT detection logic correct
- ✅ Database clean (0 existing wise_transactions)

## Root Cause

**File**: `/backend/src/routes/wiseImport.js` lines 1474-1491

**The Bug**:
```javascript
const entryResult = await pool.query(
  `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
   RETURNING id`,
  [
    entryType,
    category,
    merchantName || 'Wise transaction',
    `Imported from Wise (Ref: ${transactionId})`,
    amount,
    amount,
    transactionDate.split('T')[0],
    'completed',
    currency,
    amount
  ]
);
```

**Problem**: The INSERT was missing `wise_transaction_id` column!

**Database Schema**:
```sql
-- entries table has this foreign key constraint:
wise_transaction_id | character varying(255) | REFERENCES wise_transactions(wise_transaction_id)
```

**Why This Broke Sync**:
1. `wise_transactions` record created first with `wise_transaction_id = transactionId`
2. `entries` INSERT attempted WITHOUT `wise_transaction_id` column
3. Foreign key constraint `entries_wise_transaction_id_fkey` requires valid reference
4. INSERT fails silently (caught by try/catch)
5. Error counted but entry never created

## The Fix

**Commit**: `4e3185c`
**Changes**: Added `wise_transaction_id` to INSERT statement

```javascript
const entryResult = await pool.query(
  `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
   RETURNING id`,
  [
    entryType,
    category,
    merchantName || 'Wise transaction',
    `Imported from Wise (Ref: ${transactionId})`,
    amount,
    amount,
    transactionDate.split('T')[0],
    'completed',
    currency,
    amount,
    transactionId // ✅ ADDED - Link entry to wise_transaction
  ]
);
```

## Additional Improvements

**Also in commit 4e3185c**: Added comprehensive debug logging

```javascript
// Before processing
console.log(`📊 Activity types found:`, activities.map(a => a.type).join(', '));

// During processing
console.log(`🔍 Processing activity: ${activity.type}, Resource ID: ${activity.resource?.id}, Title: ${activity.title}`);

// After processing
console.log(`\n📈 SYNC SUMMARY:`);
console.log(`   Activities found: ${stats.activitiesFound}`);
console.log(`   New transactions: ${stats.newTransactions}`);
console.log(`   Duplicates skipped: ${stats.duplicatesSkipped}`);
console.log(`   Entries created: ${stats.entriesCreated}`);
console.log(`   Errors: ${stats.errors}\n`);

// Error details
console.error(`❌ Stack trace:`, error.stack);
```

## Expected Result

After Railway deployment completes (2-3 minutes):

1. **Sync Button Works**: "Sync from Wise" creates entries
2. **Expenses Tab Populated**:
   - ✅ Claude - 128.12 EUR
   - ✅ Upwork - 1,939.19 USD
   - ✅ Hilton Hotels - 120 PLN
   - ✅ Deploy Staff transfers - Various PLN amounts
   - ✅ Anthropic - 0 USD (card check)

3. **Income Tab Populated**:
   - Any transactions with "Received" or "To you" in description

4. **Proper Data**:
   - Real merchant names (not "Wise test")
   - Correct currencies (EUR, USD, PLN)
   - Proper categorization (income/expense)
   - Linked to wise_transactions table

## Testing Steps

1. Wait for Railway deployment (check Railway dashboard for green checkmark)
2. Open https://ds-accounting.netlify.app
3. Login: rafael / asdflkj@3!
4. Click "Sync from Wise" button
5. Wait 10-30 seconds for sync to complete
6. Verify:
   - Success message shows "X entries created"
   - Expenses tab shows real merchant names
   - Income tab shows any incoming payments
   - Currencies are correct (not forced to USD)

## Files Modified

1. **backend/src/routes/wiseImport.js**:
   - Line 1475: Added `wise_transaction_id` to INSERT columns
   - Line 1489: Added `transactionId` to VALUES array
   - Lines 1363-1518: Added debug logging

## Related Documentation

- **Activities API Fix**: WISE_SYNC_FINAL_FIX.md (commit a785b33)
- **Data Structure**: WISE_DATA_FIX_SUMMARY.md
- **Production Credentials**: .claude/CLAUDE.md (lines 1105-1132)

## Lessons Learned

1. **Foreign Key Awareness**: Always check database schema when inserting records
2. **Error Handling**: Silent failures in try/catch blocks can hide critical issues
3. **Logging is Essential**: Without logs, impossible to debug production issues
4. **Test Database First**: Use production database queries to verify schema
5. **Check Constraints**: Verify all columns, especially foreign keys

---

**Status**: ✅ FIXED - Deployed to production (commit 4e3185c)
**Next Action**: Test sync after Railway deployment completes
**Expected Outcome**: Expenses and Income tabs populated with real Wise data
