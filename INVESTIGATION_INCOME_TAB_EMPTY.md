# Investigation Report: Income Tab Empty After Wise Sync

**Date**: October 28, 2025
**Issue**: User reports Income tab shows "0 entries" despite Wise balance widget showing $35,692.062

---

## Summary

After thorough investigation, I discovered that **the Wise account is completely empty** (0 balances, 0 transactions). The $35,692 shown in the dashboard widget comes from the local `currency_balances` database table, NOT from the real Wise account.

---

## Investigation Steps & Findings

### 1. Database Analysis

**Query**: Check entries by type
```sql
SELECT type, COUNT(*), SUM(amount_original) FROM entries GROUP BY type;
```

**Result**:
- **46 expense entries** totaling $27,778
- **0 income entries**
- All entries are type='expense'

**Query**: Check wise_transactions
```sql
SELECT type, COUNT(*) FROM wise_transactions GROUP BY type;
```

**Result**:
- **5 transactions, ALL type='DEBIT'** (outgoing payments)
- 0 CREDIT transactions (no incoming payments)

**Query**: Check currency_balances table
```sql
SELECT currency, balance, last_updated FROM currency_balances;
```

**Result**:
| Currency | Balance | Last Updated |
|----------|---------|--------------|
| USD | $33,622.12 | 2025-10-28 17:53:08 |
| PLN | 7,534.59 PLN | 2025-10-28 17:53:08 |
| EUR | €0.00 | 2025-10-28 17:53:08 |
| GBP | £0.00 | 2025-10-28 17:53:08 |

**Total in USD**: ~$35,692 (matches dashboard widget!)

---

### 2. Wise API Testing

**Test 1**: Check real Wise account balances
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.wise.com/v4/profiles/74801255/balances?types=STANDARD"
```

**Result**:
```json
{
  "EUR": { "value": 0 },
  "PLN": { "value": 0 },
  "USD": { "value": 0 }
}
```

**❌ ALL BALANCES ARE ZERO**

**Test 2**: Check Wise activities (transaction history)
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.wise.com/v1/profiles/74801255/activities"
```

**Result**:
```json
{
  "cursor": null,
  "activities": []
}
```

**❌ NO TRANSACTIONS IN WISE ACCOUNT**

---

## Root Cause Analysis

### The Discrepancy

**Dashboard Widget** (shows $35,692):
- Source: `currency_balances` table in local database
- Updated: 2025-10-28 17:53:08
- Values: USD $33,622.12 + PLN 7,534.59

**Real Wise Account** (via API):
- EUR: $0
- PLN: $0
- USD: $0
- Activities: 0 transactions

### Why This Happened

The `currency_balances` table contains **stale or manually-entered data** that doesn't reflect the real Wise account state. Possible causes:

1. **Initial Setup**: Balances were manually seeded during testing
2. **Old CSV Import**: Balances from a previous CSV import that's no longer in Wise
3. **Wrong Credentials**: Connected to wrong Wise account
4. **Account Changed**: Wise account was reset/cleared after balances were synced

---

## Code Review: Transfer Direction Logic

While investigating, I also identified a **potential bug** in the sync logic (though it doesn't affect this case since the account is empty):

**File**: `backend/src/routes/wiseImport.js`
**Line**: 1439

```javascript
const type = transfer.sourceValue ? 'DEBIT' : 'CREDIT';
```

**Problem**: This checks if `sourceValue` exists, but both incoming and outgoing transfers have `sourceValue`. This would incorrectly mark ALL transfers as DEBIT.

**Correct Logic Should Be**:
```javascript
// Check which account is ours (sourceAccount vs targetAccount)
// If sourceAccount is null, money is LEAVING our account (DEBIT)
// If targetAccount is null, money is COMING TO our account (CREDIT)
const type = transfer.sourceAccount === null ? 'DEBIT' : 'CREDIT';
```

**Example**:
```json
// Outgoing transfer (money leaving our account)
{
  "id": 55576213,
  "sourceAccount": null,      // <-- Our account (null = our multi-currency account)
  "targetAccount": 701684575, // <-- Recipient's account
  "sourceValue": 998.87       // <-- Amount leaving
}
// Should be: DEBIT ✓

// Incoming transfer (money coming to our account)
{
  "id": 55576214,
  "sourceAccount": 701684575, // <-- Sender's account
  "targetAccount": null,      // <-- Our account (null = our multi-currency account)
  "targetValue": 1500.00      // <-- Amount arriving
}
// Should be: CREDIT ✓
```

---

## Recommendations

### Immediate Actions

1. **Verify Wise Account Credentials**:
   - Confirm `WISE_API_TOKEN` and `WISE_PROFILE_ID` are correct
   - Check if this is the right Wise account (personal vs business?)
   - Test in Wise dashboard: wise.com → Activity → See if there are transactions

2. **If Account is Correct but Empty**:
   - The Income tab being empty is **expected behavior**
   - No transactions in Wise = no income entries to sync
   - The $35,692 in dashboard is from local database (not Wise)

3. **If Wrong Account Connected**:
   - Update `WISE_API_TOKEN` and `WISE_PROFILE_ID` in Railway environment variables
   - Re-run Wise sync
   - Income entries should appear if the correct account has transactions

### Future Fixes

1. **Fix Transfer Direction Logic**:
   - Update line 1439 in `wiseImport.js`
   - Use `sourceAccount === null` to determine direction
   - Test with actual incoming transfers once account has activity

2. **Add Balance Validation**:
   - Before updating `currency_balances`, compare with real Wise balances
   - Warn user if local balance > Wise balance (indicates stale data)
   - Add "Last synced with Wise" timestamp to dashboard widget

3. **Activity Type Filtering**:
   - Current code only processes `activity.type === 'TRANSFER'`
   - May need to include `DEPOSIT`, `CONVERSION`, `CARD` activity types
   - Review Wise API docs for complete list of activity types

---

## Questions for User

1. **Is the Wise account supposed to have transactions?**
   - If yes, please verify API credentials are correct
   - If no, the empty Income tab is expected

2. **Where did the $35,692 balance come from?**
   - Was this manually entered?
   - From a previous CSV import?
   - Should we reset currency_balances to match Wise (all $0)?

3. **Are you testing with sandbox or production Wise account?**
   - Sandbox accounts often start empty
   - Production accounts should have real transactions

4. **Do you see transactions in the Wise web dashboard?**
   - Go to wise.com → Activity tab
   - If transactions exist there but not syncing, we have a sync bug
   - If no transactions there either, account is genuinely empty

---

## Testing Checklist

If user confirms account should have transactions:

- [ ] Verify `WISE_API_TOKEN` in Railway environment variables
- [ ] Verify `WISE_PROFILE_ID` matches the correct account
- [ ] Test API connection: `/api/wise-test/test-all`
- [ ] Check Wise dashboard for visible transactions
- [ ] Re-run sync after confirming credentials
- [ ] Verify both DEBIT and CREDIT transactions appear after sync

---

## Conclusion

**The Income tab is empty because the connected Wise account has NO transactions** (0 activities, 0 balances). This is not a sync bug, but rather an empty account issue.

The $35,692 shown in the dashboard widget is from the local `currency_balances` table, which contains outdated or manually-entered data that doesn't match the real Wise account state.

**Next Step**: User needs to clarify if they're using the correct Wise account credentials and if that account is supposed to have transactions.
