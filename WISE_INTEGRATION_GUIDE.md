# Wise Integration Deployment Guide
## Business Accounting System - Automatic Transaction Sync

Complete guide for deploying the Wise bank transaction integration feature with automatic classification and employee salary matching.

---

## Overview

The Wise integration automatically syncs bank transactions from your Wise account into the accounting system, with intelligent classification and employee matching capabilities.

### Key Features
- ✅ **Automatic transaction sync** via webhooks
- ✅ **AI-powered expense classification** using keyword matching
- ✅ **Smart salary detection** with employee matching (combination approach)
- ✅ **Confidence scoring** system (auto-create at 80%+, manual review below)
- ✅ **Manual review queue** for low-confidence transactions
- ✅ **Audit trail** for all sync operations
- ✅ **Duplicate prevention** mechanism

---

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Wise      │ Webhook │   Railway    │  Sync   │   PostgreSQL    │
│   API       │────────▶│   Backend    │────────▶│   Database      │
│             │         │   Express    │         │                 │
└─────────────┘         └──────┬───────┘         └─────────────────┘
                              │
                              │ API
                              ▼
                        ┌──────────────┐
                        │   Netlify    │
                        │   Frontend   │
                        │   React      │
                        └──────────────┘
```

---

## Part 1: Database Setup

### Step 1: Run the Migration

The migration creates three new tables:
- `wise_transactions` - Stores raw Wise transaction data
- `wise_classification_rules` - Keyword-based classification rules
- `wise_sync_audit_log` - Audit trail for all operations

It also updates the `entries` table with Wise-related columns.

```bash
cd /Users/rafael/Windsurf/accounting

# Local database
psql -U accounting_user -d accounting_db -f backend/migrations/009_wise_integration.sql

# Railway database (production)
PGPASSWORD=iiijaeSBDPUckvGWSopVfrJmvlpNzmDp psql -h gondola.proxy.rlwy.net -p 41656 -U postgres -d railway -f backend/migrations/009_wise_integration.sql
```

### Step 2: Verify Tables Created

```bash
# Local
psql -U accounting_user -d accounting_db -c "\dt"

# Railway
PGPASSWORD=iiijaeSBDPUckvGWSopVfrJmvlpNzmDp psql -h gondola.proxy.rlwy.net -p 41656 -U postgres -d railway -c "\dt"
```

Expected output should include:
- `wise_transactions`
- `wise_classification_rules`
- `wise_sync_audit_log`
- Updates to `entries` table

---

## Part 2: Backend Environment Configuration

### Local Development (.env)

The `.env` file already has Wise configuration:

```bash
# Existing Wise configuration
WISE_API_TOKEN=3fef0a08-05a8-499a-8309-42dfd70054ae
WISE_API_BASE_URL=https://api.transferwise.com
WISE_PROFILE_ID=74801255
WISE_SYNC_INTERVAL=300000

# NEW: Add webhook secret
WISE_WEBHOOK_SECRET=your_random_secret_here_min_32_chars
```

### Generate Webhook Secret

```bash
# Generate a strong random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated secret and add it to `.env`:

```bash
WISE_WEBHOOK_SECRET=<generated_secret_here>
```

---

## Part 3: Railway Deployment

### Step 1: Add Environment Variables to Railway

Go to Railway dashboard → `business-accounting-system` service → **Variables** tab

Add these **4 new variables**:

#### 1. WISE_API_TOKEN
```
3fef0a08-05a8-499a-8309-42dfd70054ae
```

#### 2. WISE_PROFILE_ID
```
74801255
```

#### 3. WISE_API_BASE_URL
```
https://api.transferwise.com
```

#### 4. WISE_WEBHOOK_SECRET
```
<generated_secret_from_step_above>
```

**Note**: Keep the webhook secret secure - it's used to validate incoming webhooks from Wise.

### Step 2: Fix DATABASE_URL (if not done yet)

Make sure `DATABASE_URL` uses the Railway reference syntax:

```
${{Postgres.DATABASE_URL}}
```

This ensures it auto-updates when you regenerate the PostgreSQL password.

### Step 3: Deploy Changes

Railway will automatically redeploy when you:
1. Push code changes to GitHub (`live` branch)
2. Add/update environment variables

Wait for:
- ✅ Status: **Active**
- ✅ Deployment: **Successful**

### Step 4: Verify Backend Deployment

Test the Wise routes:

```bash
# Replace with your Railway URL
RAILWAY_URL="https://business-accounting-system-production.up.railway.app"

# Test health endpoint (should work)
curl $RAILWAY_URL/health

# Test Wise connection (requires auth token - get from login)
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" $RAILWAY_URL/api/wise/test-connection
```

---

## Part 4: Wise Webhook Configuration

### Step 1: Get Your Webhook URL

Your webhook URL is:
```
https://business-accounting-system-production.up.railway.app/api/wise/webhook
```

### Step 2: Register Webhook with Wise

**Option A: Using Wise Dashboard (Recommended)**

1. Go to https://wise.com/settings/integrations
2. Click "Webhooks"
3. Click "Add webhook"
4. Fill in:
   - **Name**: "Accounting System Sync"
   - **URL**: `https://business-accounting-system-production.up.railway.app/api/wise/webhook`
   - **Events**: Select `balances#credit` and `balances#update`
   - **Secret**: Use the `WISE_WEBHOOK_SECRET` you generated

**Option B: Using Wise API (Advanced)**

```bash
# Get your Wise API token
WISE_TOKEN="3fef0a08-05a8-499a-8309-42dfd70054ae"
WISE_PROFILE="74801255"
WEBHOOK_URL="https://business-accounting-system-production.up.railway.app/api/wise/webhook"

# Create webhook subscription
curl -X POST "https://api.transferwise.com/v3/profiles/${WISE_PROFILE}/subscriptions" \
  -H "Authorization: Bearer ${WISE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Accounting System Sync",
    "trigger_on": "balances#credit,balances#update",
    "delivery": {
      "version": "2.0.0",
      "url": "'${WEBHOOK_URL}'"
    }
  }'
```

### Step 3: Test Webhook

Wise will send a test webhook when you register it. Check Railway logs:

```
Go to Railway → business-accounting-system → Deployments → Deploy Logs
```

Look for:
```
Received Wise test webhook
```

---

## Part 5: Frontend Deployment (Netlify)

The frontend code is already updated with the Wise Sync tab. Just redeploy:

### Automatic Deployment

If you have auto-deploy enabled on Netlify:
1. Push code to GitHub (`live` branch)
2. Netlify automatically builds and deploys

### Manual Deployment

If auto-deploy is not configured:
1. Go to Netlify dashboard
2. Click on your site
3. Click "Trigger deploy" → "Deploy site"

### Verify Frontend

1. Go to https://your-app.netlify.app
2. Login with your credentials
3. You should see a new tab: **"Wise Sync"**

---

## Part 6: Testing the Integration

### Test 1: Manual Sync

1. Login to the app
2. Go to **Wise Sync** tab
3. Click **"Sync Last 7 Days"** button
4. You should see:
   - Fetching transactions message
   - Results showing:
     - Total transactions found
     - New transactions added
     - Already existing (skipped)
     - Successfully processed

### Test 2: Transaction Classification

Check the "Pending Review" section for transactions that need manual review (confidence < 80%).

Expected behavior:
- **Salary payments** with matching employee amounts should have high confidence (80%+)
- **Expenses** matching classification rules should be auto-categorized
- **Unknown transactions** will have low confidence and require review

### Test 3: Review Queue

1. Click **"Review"** on a pending transaction
2. Modal shows:
   - Transaction details
   - Suggested category and confidence score
   - Option to approve or skip
3. Select/confirm category
4. If "Employee" category, select the employee
5. Click **"Approve & Create Entry"**
6. Entry is created in the accounting system

### Test 4: Webhook (Live Transaction)

Make a test transaction in your Wise account:
1. Send a small amount to yourself or a test recipient
2. Wait for webhook to trigger (usually instant)
3. Check Railway logs for webhook received message
4. Check Wise Sync tab for the new transaction

---

## Part 7: Classification Rules

### Default Rules (Pre-loaded)

The system comes with 10 default classification rules:

| Priority | Keyword Pattern | Category |
|----------|----------------|----------|
| 100 | AWS, Google Cloud, Azure, DigitalOcean | Software |
| 90 | GitHub, Jira, Slack, Notion | Software |
| 80 | Rent, Lease, Landlord | Administration |
| 80 | Internet, Electricity, Utilities | Administration |
| 70 | License, Subscription, SaaS | Software |
| 70 | Ads, Marketing, Facebook Ads | Marketing |
| 60 | Supplies, Equipment, Furniture | Administration |
| 60 | Legal, Lawyer, Attorney | Professional Services |
| 60 | Accountant, Bookkeeping, Tax | Professional Services |
| 50 | Bank Fee, Service Charge | Bank Fees |

### Adding Custom Rules

You can add custom rules directly in the database:

```sql
INSERT INTO wise_classification_rules (
  rule_name,
  keyword_pattern,
  target_category,
  priority,
  is_active
) VALUES (
  'Cloud Storage',
  '(?i)(dropbox|onedrive|icloud|backblaze)',
  'Software',
  85
);
```

---

## Part 8: Employee Salary Matching

### How It Works

The system uses a **combination approach** for matching salaries to employees:

#### Step 1: Amount Matching (0-50 points)
- **Exact match**: 50 points
- **Within 5%**: 40 points
- **Within 10%**: 25 points

#### Step 2: Name Matching (0-30 points)
- **Full name in transaction**: 30 points
- **Partial name match**: 15 points per name part

#### Step 3: Payment Schedule (0-10 points)
- **Weekly** payments on Friday/Thursday: 10 points
- **Monthly** payments at end of month or first days: 10 points

#### Confidence Thresholds
- **80%+**: Auto-create entry (no review needed)
- **40-79%**: Flag for manual review
- **<40%**: Not matched (classify as regular expense)

### Example Scenarios

**Scenario 1: High Confidence Match**
```
Transaction: $5,000 to "John Doe - Salary Payment"
Employee: John Doe, $5,000/month
Result:
  - Amount match: 50 points
  - Name match: 30 points (full name)
  - Schedule match: 10 points (end of month)
  - Total: 90% confidence → Auto-created
```

**Scenario 2: Medium Confidence**
```
Transaction: $2,100 (no description)
Employee: Jane Smith, $2,000/month
Result:
  - Amount match: 25 points (within 10%)
  - Name match: 0 points (no name)
  - Schedule match: 10 points
  - Total: 35% confidence → Not matched, classified as expense
```

**Scenario 3: Manual Review Needed**
```
Transaction: $3,000 to "Contractor Payment"
Employee: Bob Johnson, $3,000/month
Result:
  - Amount match: 50 points
  - Name match: 0 points
  - Schedule match: 0 points
  - Total: 50% confidence → Flagged for review
```

---

## Part 9: Monitoring & Maintenance

### Check Sync Statistics

```bash
# Using curl (with authentication)
TOKEN="<your_jwt_token_here>"
curl -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise/stats
```

Expected response:
```json
{
  "total_transactions": 150,
  "pending_count": 5,
  "processed_count": 140,
  "failed_count": 2,
  "skipped_count": 3,
  "needs_review_count": 5,
  "avg_confidence_score": 75.5
}
```

### View Railway Logs

```
Railway Dashboard → business-accounting-system → Deployments → Deploy Logs
```

Look for:
- Webhook received messages
- Classification results with confidence scores
- Entry creation confirmations
- Any errors or warnings

### Common Log Messages

✅ **Success**:
```
Wise transaction saved: TXN_123 - Category: Employee, Confidence: 95%, Needs Review: false
✅ Entry created for Wise transaction TXN_123: Salary - John Doe (expense USD 5000.00)
```

⚠️ **Review Needed**:
```
Wise transaction saved: TXN_456 - Category: Software, Confidence: 60%, Needs Review: true
```

❌ **Error**:
```
Error processing transaction TXN_789: Database connection error
```

---

## Part 10: Troubleshooting

### Issue: Webhook Not Receiving Events

**Symptoms:**
- No new transactions appearing after Wise payments
- Railway logs show no webhook activity

**Solution:**
1. Verify webhook URL is correct:
   ```
   https://business-accounting-system-production.up.railway.app/api/wise/webhook
   ```
2. Check Wise webhook settings (Dashboard → Integrations → Webhooks)
3. Ensure `WISE_WEBHOOK_SECRET` matches what you set in Wise
4. Test webhook with manual sync: Click "Sync Last 7 Days" button

---

### Issue: "Invalid signature" Error

**Symptoms:**
```
Invalid Wise webhook signature
```

**Solution:**
1. Verify `WISE_WEBHOOK_SECRET` in Railway matches the secret used in Wise webhook configuration
2. Regenerate the secret if needed:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Update both Railway variable and Wise webhook configuration

---

### Issue: Transactions Not Auto-Creating Entries

**Symptoms:**
- Transactions appear in Wise Sync tab
- All transactions require manual review
- No entries created automatically

**Solution:**
1. Check confidence scores - must be 80%+ to auto-create
2. Review classification rules in database
3. For salary matching:
   - Verify employee pay rates match transaction amounts
   - Check if employee names appear in transaction descriptions
4. Manually approve transactions to create entries

---

### Issue: Duplicate Transactions

**Symptoms:**
- Same transaction appears multiple times

**Solution:**
- The system has built-in deduplication using `wise_transaction_id`
- If duplicates appear, check Railway logs for errors
- Database constraint prevents true duplicates:
  ```sql
  UNIQUE (wise_transaction_id)
  ```

---

### Issue: Classification Rules Not Working

**Symptoms:**
- Expenses always categorized as "Other Expenses"
- Low confidence scores for known merchants

**Solution:**
1. Verify rules exist in database:
   ```sql
   SELECT * FROM wise_classification_rules WHERE is_active = true;
   ```
2. Check rule priority (higher priority = higher confidence boost)
3. Test pattern matching:
   ```sql
   SELECT * FROM wise_classification_rules
   WHERE 'AWS Lambda charges' ~* keyword_pattern;
   ```
4. Add custom rules for your specific merchants

---

## Part 11: API Endpoints Reference

All Wise endpoints require authentication (except webhook).

### POST /api/wise/webhook
**Public endpoint** (signature validated)
- Receives webhook events from Wise
- Processes transactions automatically

### GET /api/wise/sync?days=7
**Manual sync** of recent transactions
- Query param: `days` (default: 7)
- Returns: Sync results with counts

### GET /api/wise/pending-review
**Get transactions needing manual review**
- Returns: Array of transactions with confidence < 80%

### GET /api/wise/stats
**Get sync statistics**
- Returns: Total counts, averages, status breakdown

### POST /api/wise/review/:id
**Approve or skip a transaction**
- Body: `{ action: 'approve' | 'skip', category?: string, employeeId?: number }`
- Returns: Success message

### GET /api/wise/test-connection
**Test Wise API connection**
- Returns: `{ success: true }` if connection works

---

## Part 12: Security Considerations

### Webhook Signature Validation

All webhooks are validated using HMAC-SHA256:

```javascript
// Automatic in the code
const isValid = WiseSignatureValidator.validateRequest(req, WISE_WEBHOOK_SECRET);
```

### API Token Security

- Never commit API tokens to Git
- Use environment variables for all secrets
- Rotate tokens periodically in Wise dashboard

### Database Security

- Use connection pooling with SSL
- Railway PostgreSQL enforces SSL in production
- Audit log tracks all transaction modifications

---

## Part 13: Future Enhancements

Potential improvements for the Wise integration:

1. **Multi-currency Support**
   - Handle transactions in different currencies
   - Automatic conversion to base currency

2. **Batch Processing**
   - Schedule automatic syncs every N hours
   - Background job processing for large transaction volumes

3. **Machine Learning Classification**
   - Train model on historical data
   - Improve classification accuracy over time

4. **Receipt Attachment**
   - Link Wise transaction receipts to accounting entries
   - Store receipt images in cloud storage

5. **Spending Analytics**
   - Merchant-based spending reports
   - Category trend analysis
   - Budget alerts based on Wise activity

---

## Support & Resources

- **Wise API Docs**: https://docs.wise.com/api-docs
- **Railway Docs**: https://docs.railway.app
- **Netlify Docs**: https://docs.netlify.com
- **Project Repository**: https://github.com/RafaelEpicMegacorp/business-accounting-system

---

## Summary Checklist

Before going live, ensure:

- ✅ Database migration run successfully
- ✅ All environment variables added to Railway
- ✅ Webhook registered with Wise
- ✅ Frontend deployed with Wise Sync tab
- ✅ Manual sync test completed successfully
- ✅ At least one transaction reviewed and entry created
- ✅ Classification rules verified in database
- ✅ Employee matching tested with sample salary payment

---

*Last Updated: 2025-10-17*
*Version: 1.0.0*
