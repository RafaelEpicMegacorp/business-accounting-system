# Balance Reconciliation Guide

## What is Balance Reconciliation?

The **Balance Reconciliation Note** appears on your Forecast page when there's a difference between your actual bank balance (from Wise) and your accounting records (from manual entries). This helps you identify missing transactions or data entry errors.

## Understanding the Numbers

### Example Reconciliation Note

```
Balance Reconciliation Note
There is a $184,050.86 difference between your Wise bank balance and accounting records:

Wise Bank Balance:          $32,662.10
Accounting Balance:        -$184,050.86
Difference:                $216,712.96
```

### What Each Balance Means

#### 1. Wise Bank Balance
- **Source:** Real-time data from your Wise account via API
- **What it shows:** Your actual available money across all currencies
- **Currencies:** Automatically converts USD, EUR, GBP, PLN to USD
- **This is reality:** What you actually have in the bank

#### 2. Accounting Balance (Entries)
- **Source:** Calculated from your manual income and expense entries
- **Formula:** `Total Income - Total Expenses = Net Balance`
- **What it shows:** What your records say you should have
- **This is your bookkeeping:** Based on what you've entered

#### 3. Difference
- **Formula:** `Wise Bank Balance - Accounting Balance`
- **What it means:** How far off your records are from reality

## Common Scenarios

### Scenario 1: Negative Accounting Balance (Your Case)
**Example:**
- Wise: $32,662.10
- Accounting: -$184,050.86
- Difference: $216,712.96

**What this means:**
- You've recorded MORE expenses than income in your system
- But your bank account is positive
- You're missing ~$216k in income entries

**Why this happens:**
1. ✅ **Started tracking mid-way** - System began from $0, ignoring your existing balance
2. ✅ **Missing income entries** - Deposits received but not recorded
3. ✅ **Unsynced Wise transactions** - Income in Wise not imported to accounting
4. ⚠️ **Wrong starting point** - Didn't set an opening balance

**How to fix:**
- Add a "Starting Balance" income entry for $216,712.96 (or the exact difference)
- Or sync all historical Wise transactions to import missing income
- Or manually review and add missing income entries

### Scenario 2: Positive Difference (Accounting Higher Than Bank)
**Example:**
- Wise: $10,000
- Accounting: $15,000
- Difference: -$5,000

**What this means:**
- Your records show you should have MORE money than you actually do
- You're missing $5k in expense entries or have phantom income

**Why this happens:**
1. ⚠️ **Missing expense entries** - Spent money but didn't record it
2. ⚠️ **Duplicate income** - Same income entered twice
3. ⚠️ **Pending entries marked completed** - Counted income before receiving it
4. ⚠️ **Wrong currency conversion** - Exchange rate errors

**How to fix:**
- Review recent expenses and find missing transactions
- Check for duplicate income entries
- Verify pending vs completed status of entries

### Scenario 3: Small Difference (<$10)
**Example:**
- Wise: $32,662.10
- Accounting: $32,658.45
- Difference: $3.65

**What this means:**
- Minor discrepancy, likely from rounding or timing

**Why this happens:**
1. ✅ **Rounding differences** - Decimal precision in calculations
2. ✅ **Pending transactions** - In-flight transfers
3. ✅ **Currency conversion timing** - Exchange rates changed
4. ✅ **Bank fees** - Small fees not yet recorded

**How to fix:**
- Generally acceptable, no action needed if <$10
- Add a reconciliation adjustment entry if desired

## How to Reconcile Your Accounts

### Method 1: Add Starting Balance (Quick Fix)

**When to use:** First time setup, or started tracking mid-way

**Steps:**
1. Note the difference amount (e.g., $216,712.96)
2. Go to Income tab
3. Click "Add Entry"
4. Enter:
   - Type: Income
   - Category: "Starting Balance" or "Opening Balance"
   - Description: "Opening balance adjustment"
   - Amount: [Difference amount]
   - Date: First day you started tracking
   - Status: Completed
5. Save entry
6. Check Forecast - difference should now be $0

**Pros:** Quick, simple
**Cons:** Doesn't show transaction history

### Method 2: Sync Wise History (Recommended)

**When to use:** Want complete transaction history

**Steps:**
1. Go to Dashboard
2. Click "Sync Wise History" button
3. Select date range (e.g., last 6 months)
4. System automatically imports all Wise transactions
5. Review imported entries for accuracy
6. Classify any unclassified transactions
7. Check Forecast - difference should be minimal

**Pros:** Complete history, accurate records
**Cons:** Takes longer, may need manual classification

### Method 3: Manual Review (Most Accurate)

**When to use:** Small discrepancy or suspicious transactions

**Steps:**
1. Export your Wise transaction history (CSV)
2. Export your accounting entries (CSV export feature)
3. Compare side-by-side in spreadsheet
4. Identify missing transactions:
   - Income in Wise but not in accounting → Add income entry
   - Expense in accounting but not in Wise → Verify if correct
5. Add missing entries manually
6. Check Forecast after each entry

**Pros:** Most accurate, catches errors
**Cons:** Time-consuming

## Understanding the Forecast Impact

The reconciliation note includes this message:

> "This difference may be due to unsynced Wise transactions or manual entries not yet reconciled. **The forecast uses your actual Wise bank balance for accuracy.**"

**What this means:**
- Your forecast calculations START from your real Wise balance ($32,662.10)
- NOT from your accounting balance (-$184,050.86)
- This ensures forecasts are realistic and based on actual available funds
- Your future projections won't be wrong even if your past records are incomplete

**Why this is good:**
- Prevents overspending based on wrong balance
- Forecasts remain accurate even during reconciliation
- You can trust end-of-month predictions

## Technical Details

### How Wise Balance is Calculated

**Database Query:**
```sql
SELECT SUM(
  CASE cb.currency
    WHEN 'USD' THEN cb.balance
    WHEN 'EUR' THEN cb.balance * exchange_rate_eur_usd
    WHEN 'GBP' THEN cb.balance * exchange_rate_gbp_usd
    WHEN 'PLN' THEN cb.balance * exchange_rate_pln_usd
    ELSE cb.balance
  END
) as total_usd
FROM currency_balances cb
```

**Data Source:** `currency_balances` table, updated via Wise API

### How Accounting Balance is Calculated

**Database Query:**
```sql
SELECT
  SUM(CASE WHEN type = 'income' AND status = 'completed' THEN total ELSE 0 END) -
  SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN total ELSE 0 END)
  as net_balance
FROM entries
WHERE status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)
```

**Data Source:** `entries` table, manually entered or synced

### When Reconciliation Note Appears

**Condition:** `Math.abs(difference) > 0.01`

**Location:** Forecast page (`/forecast`)

**Color coding:**
- Yellow warning box when difference exists
- Hidden when difference is less than $0.01

## Frequently Asked Questions

### Q: Is this a bug in the system?
**A:** No, this is a feature! It's alerting you that your manual records don't match your bank reality. The system is working correctly by showing you the discrepancy.

### Q: Which balance should I trust?
**A:** Always trust the **Wise Bank Balance**. This is real-time data from your actual bank account. Your accounting balance is only as accurate as your data entry.

### Q: Will this affect my forecasts?
**A:** No, forecasts use your actual Wise balance for accuracy. Your future predictions are based on reality, not your incomplete records.

### Q: Can I ignore this?
**A:** You can, but it's not recommended. The discrepancy indicates incomplete records, which can lead to:
- Incorrect financial reporting
- Tax calculation errors
- Poor business decisions based on wrong data
- Inability to track actual income/expense trends

### Q: How often should I reconcile?
**A:** Best practices:
- **Daily:** If you're actively using Wise (sync transactions automatically)
- **Weekly:** Review for any discrepancies
- **Monthly:** Full reconciliation before month-end reports
- **Quarterly:** Deep audit of all transactions

### Q: What if the difference keeps growing?
**A:** This means you're continuously missing transactions. Enable automatic Wise sync or establish a daily routine to manually enter transactions as they occur.

### Q: My accounting balance is negative but my bank is positive. Is this normal?
**A:** Yes, this is common when you start tracking mid-way through operations. You likely had an existing balance that wasn't recorded as an opening balance. Add a "Starting Balance" income entry to fix this.

### Q: The difference is small ($0.05). Should I fix it?
**A:** Differences under $10 are often due to rounding or timing. You can:
- Ignore it if it's negligible
- Add a "Reconciliation Adjustment" entry to zero it out
- Wait - it may resolve itself when pending transactions complete

## Best Practices

1. ✅ **Enable Wise Sync** - Automatically import transactions daily
2. ✅ **Set Opening Balance** - Start with correct initial balance
3. ✅ **Regular Reviews** - Check reconciliation note weekly
4. ✅ **Immediate Entry** - Enter manual transactions immediately
5. ✅ **Monthly Close** - Reconcile to $0 difference before month-end
6. ✅ **Category Consistency** - Use same categories for similar transactions
7. ✅ **Document Adjustments** - Add notes when making reconciliation entries

## Troubleshooting

### Problem: Difference doesn't change after adding entries
**Solution:**
- Clear browser cache and refresh
- Check entry status (must be "completed" or past pending)
- Verify entry date is not in future
- Wait for Wise balance to update (can take 5 minutes)

### Problem: Wise balance shows $0
**Solution:**
- Check Wise API connection in settings
- Verify API token is valid and not expired
- Sync currency balances manually
- Check `currency_balances` table has data

### Problem: Accounting balance seems wrong
**Solution:**
- Review all entries for duplicates
- Check for entries with incorrect signs (income marked as expense)
- Verify no orphaned entries from deleted employees/contracts
- Export entries CSV and sum manually to verify

### Problem: Difference is huge and I don't know where to start
**Solution:**
1. Start with Method 1 (add opening balance) to stabilize
2. Going forward, use Method 2 (sync Wise) for all new transactions
3. Don't try to fix historical data unless absolutely necessary
4. Focus on keeping future records accurate

## Related Documentation

- [README.md](./README.md) - General system overview
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Deployment details
- [Wise Integration Guide] - How Wise sync works (coming soon)
- [CSV Export Guide] - Exporting data for analysis (coming soon)

## Support

If you continue to experience reconciliation issues:
1. Review this guide thoroughly
2. Check the Forecast page for the reconciliation note
3. Export both Wise and accounting data for manual comparison
4. Create a GitHub issue with:
   - Screenshot of reconciliation note
   - Date range of discrepancy
   - Steps you've already tried

---

**Last Updated:** 2025-11-24
**Version:** 1.0
