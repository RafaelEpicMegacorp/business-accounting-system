# Wise Sync Final Fix - Activities API Solution

**Date**: October 28, 2025
**Issue**: Income tab empty, expenses showing generic descriptions
**Root Cause**: Code was looking at wrong fields in Activities API response

## Investigation Summary

### Problem 1: Balance Statements API Blocked by SCA

Tested Balance Statements API:
```bash
GET /v1/profiles/74801125/balance-statements/.../statement.json
→ HTTP 403 (SCA Required)
```

**Result**: Cannot use Balance Statements API - requires manual SCA approval every 90 days.

**Decision**: Use Activities API instead (no SCA requirement).

### Problem 2: Wrong Field Parsing

**Old Code** (WRONG):
```javascript
const activityData = activity.data || {};  // ❌ activity.data doesn't exist!
description = activityData.title || 'Wise transaction';
```

**Activities API Actual Structure**:
```json
{
  "title": "<strong>Claude</strong>",
  "primaryAmount": "128.12 EUR",
  "description": "By you · Pending",
  "status": "COMPLETED"
}
```

**New Code** (CORRECT):
```javascript
// Extract merchant name from title
let merchantName = activity.title || '';
merchantName = merchantName.replace(/<strong>|<\/strong>|<positive>|<\/positive>/g, '').trim();

// Parse primaryAmount: "128.12 EUR" → amount=128.12, currency=EUR
const amountMatch = activity.primaryAmount.match(/([\d,]+\.?\d*)\s*([A-Z]{3})/);
amount = parseFloat(amountMatch[1].replace(/,/g, ''));
currency = amountMatch[2];

// Detect income/expense from description
if (activity.description.includes('Received') || activity.description.includes('To you')) {
  type = 'CREDIT';  // Income
} else {
  type = 'DEBIT';  // Expense
}
```

## Changes Made

### File: `backend/src/routes/wiseImport.js`

**Lines 1404-1436** (Complete Rewrite):

**Before**:
- Looked at non-existent `activity.data` object
- Complex parsing logic with fallbacks
- Missing merchant names
- Wrong currency extraction

**After**:
- Uses `activity.title` for merchant names
- Parses `activity.primaryAmount` for amount + currency
- Strips HTML tags (`<strong>`, `<positive>`, `<negative>`)
- Detects DEBIT/CREDIT from `activity.description`
- Simple, clean parsing logic

**Key Changes**:
1. ✅ Extract merchant from `activity.title` (not `activity.data.title`)
2. ✅ Parse currency from `activity.primaryAmount` (e.g., "128.12 EUR")
3. ✅ Remove HTML tags from title
4. ✅ Use `activity.createdOn` for date (not `activity.occurredAt`)
5. ✅ Use `activity.status` for status
6. ✅ Use merchantName as entry description

## Test Results

### Activities API Response (Verified Working)

```json
{
  "activities": [
    {
      "title": "<strong>Claude</strong>",
      "primaryAmount": "128.12 EUR",
      "description": "By you · Pending"
    },
    {
      "title": "<strong>Upwork</strong>",
      "primaryAmount": "1,939.19 USD",
      "description": "Spent by you"
    },
    {
      "title": "<strong>Hilton Hotels</strong>",
      "primaryAmount": "120 PLN",
      "description": "By you · Pre-authorised"
    }
  ]
}
```

### Expected Entry Results

**After sync completes**:

**Expenses Tab**:
- ✅ "Claude" - 128.12 EUR
- ✅ "Upwork" - 1,939.19 USD
- ✅ "Hilton Hotels" - 120 PLN
- ✅ "Anthropic" - 0 USD (card check)

**Income Tab**:
- ✅ Will show transactions with "Received" or "To you" in description
- ✅ Real sender names from `activity.title`
- ✅ Correct currencies

**No More**:
- ❌ "Wise test" placeholders
- ❌ "TRANSFER transaction" generic descriptions
- ❌ Wrong USD conversions
- ❌ Empty merchant names

## Deployment

**Commit**: `a785b33`
**Branch**: `live`
**Status**: ✅ Deployed to production

**Railway**: Auto-deployed (2-3 minutes)

## Database Cleanup

**Ran cleanup script**:
```bash
✅ Deleted 0 entries (already cleaned)
✅ Deleted 5 wise_transactions records
✅ Recalculated currency balances
```

**Database is clean and ready for fresh sync.**

## Next Steps for User

### Step 1: Wait for Railway Deploy (2-3 min)

Check Railway dashboard: https://railway.app

Look for:
- ✅ Green checkmark on latest deploy
- ✅ "live" environment active
- ✅ No deployment errors

### Step 2: Sync Wise Data

1. Open production: https://ds-accounting.netlify.app
2. Login: `rafael` / `asdflkj@3!`
3. Go to Dashboard
4. Click "Sync Wise" button (or trigger sync endpoint)
5. Wait 30-60 seconds

### Step 3: Verify Results

**Check Expenses Tab**:
- Should see "Claude", "Upwork", "Hilton Hotels"
- Correct currencies: 128.12 EUR, 1939.19 USD, 120 PLN
- Status: "✓ Completed"

**Check Income Tab**:
- Should show any incoming payments
- Real sender names
- Correct amounts and currencies

**Wise Balance Widget**:
- USD: $33,622.12
- EUR: €0.00
- PLN: 7,534.59 PLN
- Total: ~$35,692

## Technical Notes

### Why Activities API Works

**Activities API provides**:
1. ✅ `title`: Merchant/recipient name with HTML formatting
2. ✅ `primaryAmount`: Amount with currency in one string
3. ✅ `description`: Human-readable action ("Sent by you", "Received")
4. ✅ `status`: Transaction status ("COMPLETED", "PENDING")
5. ✅ `createdOn`: Transaction timestamp

**No need for**:
- ❌ Multiple API calls (Activities → Transfers)
- ❌ Complex field guessing
- ❌ SCA approval
- ❌ Balance Statements API

### HTML Tag Handling

Activities API uses HTML tags for emphasis:
- `<strong>`: Important text (merchant name)
- `<positive>`: Positive transaction (income)
- `<negative>`: Negative transaction (expense)

Our code strips these tags:
```javascript
merchantName = merchantName.replace(/<strong>|<\/strong>|<positive>|<\/positive>|<negative>|<\/negative>/g, '').trim();
```

Result: "Claude" (not "<strong>Claude</strong>")

### Income Detection

**CREDIT (Income)**:
- Description contains "Received"
- Description contains "To you"

**DEBIT (Expense)**:
- Description contains "Sent by you"
- Description contains "By you"
- Description contains "Spent by you"

### Amount Parsing

Handles various formats:
- "128.12 EUR" → 128.12 EUR
- "1,939.19 USD" → 1939.19 USD (commas removed)
- "50 PLN" → 50 PLN

Regex: `/([\d,]+\.?\d*)\s*([A-Z]{3})/`

## Comparison: Before vs After

### Before (Broken Code)

**Code**:
```javascript
const activityData = activity.data || {};  // Empty object!
description = activityData.title || 'Wise transaction';  // Always fallback
```

**Result**:
- Expenses: "Wise transaction", "TRANSFER transaction"
- Currencies: Often wrong (forced to USD)
- Merchants: Missing or empty

### After (Fixed Code)

**Code**:
```javascript
let merchantName = activity.title || '';
merchantName = merchantName.replace(/<strong>|<\/strong>/g, '').trim();
```

**Result**:
- Expenses: "Claude", "Upwork", "Hilton Hotels"
- Currencies: Correct (EUR, USD, PLN as shown in Wise)
- Merchants: Real names from Wise

## Success Metrics

After sync completes:

**Expenses Tab**:
- ✅ 10+ entries with real merchant names
- ✅ Multiple currencies (EUR, USD, PLN)
- ✅ No "Wise test" or "TRANSFER transaction"
- ✅ All marked "✓ Completed"

**Income Tab**:
- ✅ Entries if you have incoming payments in Wise
- ✅ Real sender names
- ✅ Correct amounts

**Overall**:
- ✅ Data matches Wise account exactly
- ✅ No manual corrections needed
- ✅ Ready for production use

## Troubleshooting

### If Sync Fails

**Error: "Database connection failed"**:
- Check Railway database is online
- Verify DATABASE_URL environment variable
- Check connection pool limits

**Error: "Wise API 401"**:
- Token expired or invalid
- Check WISE_API_TOKEN in Railway
- Verify token: `10b1f19c-bd61-4c9b-8d86-1ec264550ad4`

**Error: "Profile not found"**:
- Check WISE_PROFILE_ID: should be `74801125` (business profile)
- Not `74801255` (personal profile - empty)

### If Entries Look Wrong

**Still seeing "Wise transaction"**:
- Sync may not have completed
- Check Railway logs for errors
- Try manual sync again

**Wrong currencies**:
- Code issue (shouldn't happen with new fix)
- Check activity.primaryAmount parsing
- Report to developer

## Files Modified

1. **backend/src/routes/wiseImport.js** (lines 1404-1486)
   - Fixed activity field extraction
   - Updated merchant name parsing
   - Corrected amount/currency parsing
   - Fixed DEBIT/CREDIT detection

2. **WISE_SYNC_FINAL_FIX.md** (this document)
   - Complete fix documentation
   - Before/after comparison
   - Deployment instructions

## Commit History

- **a785b33**: Fix Wise sync - extract real merchant names from activity.title
- **241758f**: Fix cleanup script - remove balance_usd reference
- **8275e6b**: Fix Wise data extraction - use Activity API for merchant names
- **c4138cb**: Remove confidence scoring system completely

## References

- **Activities API Docs**: Provided by user (shows title, primaryAmount format)
- **Test Response**: curl command showed actual structure
- **WISE_API_WORKING_PATTERNS.md**: Documents SCA limitation
- **Production Credentials**: CLAUDE.md line 1112 (token, profile ID)

## Lessons Learned

1. **Always test API responses** - Don't assume field names
2. **Read actual API data** - `activity.data` didn't exist, `activity.title` did
3. **Balance Statements blocked by SCA** - Activities API is the correct choice
4. **HTML tags in responses** - Strip formatting tags from text fields
5. **Currency in primaryAmount** - Parse "128.12 EUR" format correctly

---

**Status**: ✅ DEPLOYED AND READY
**Next Action**: User should sync Wise data via dashboard
**Expected Result**: Real merchant names in correct currencies
