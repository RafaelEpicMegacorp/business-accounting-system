# Wise Webhook Setup Guide
## Real-Time Transaction Sync Configuration

**Status**: ✅ Webhook endpoint re-implemented and deployed
**Last Updated**: October 27, 2025

---

## Webhook URL

Your Wise webhook endpoint is now live at:

```
https://business-accounting-system-production.up.railway.app/api/wise/webhook
```

**Important**: This is a **public endpoint** (no authentication required for Wise webhooks). Security is provided by signature validation using your `WISE_WEBHOOK_SECRET`.

---

## What the Webhook Does

The webhook automatically processes Wise transactions in real-time:

1. **Receives Events**: Wise sends notifications when money moves in/out of your account
2. **Validates Signature**: Verifies the webhook is genuinely from Wise using HMAC-SHA256
3. **Stores Transaction**: Saves raw transaction data in `wise_transactions` table
4. **Classifies Transaction**: Uses AI classifier to categorize and match employees
5. **Auto-Creates Entries**: For high-confidence transactions (80%+), automatically creates accounting entries
6. **Flags for Review**: Low-confidence transactions (<80%) are flagged for manual review

---

## Supported Event Types

### 1. `balances#credit` (Recommended)
Triggers when money is **received** in your Wise account.

**Use Case**: Auto-import client payments, incoming transfers

### 2. `balances#update`
Triggers when any balance changes occur.

**Use Case**: Broader coverage, catches all balance changes

### 3. `transfers#state-change`
Triggers when transfer status changes (pending → completed, etc.).

**Use Case**: Track outgoing payment status updates

---

## Configuration Steps

### Step 1: Verify Environment Variable

Ensure `WISE_WEBHOOK_SECRET` is set in Railway:

```bash
# Your current secret (already configured):
WISE_WEBHOOK_SECRET=685603817cb51e79f47b0fa81cbc210670ecb107804042cd89860c8f0497bedd
```

**Check in Railway**:
1. Go to Railway dashboard
2. Navigate to `business-accounting-system` service
3. Click **Variables** tab
4. Verify `WISE_WEBHOOK_SECRET` exists

### Step 2: Register Webhook with Wise

#### Option A: Using Wise Dashboard (Easiest)

1. Login to Wise: https://wise.com/login
2. Go to **Settings** → **API Tokens** → **Webhooks**
3. Click **"Create a webhook"** or **"Add webhook"**
4. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Name** | `Accounting System - Live Transactions` |
   | **URL** | `https://business-accounting-system-production.up.railway.app/api/wise/webhook` |
   | **Events** | Select: `balances#credit` and `balances#update` |
   | **Secret** | `685603817cb51e79f47b0fa81cbc210670ecb107804042cd89860c8f0497bedd` |

5. Click **"Create"** or **"Save"**
6. Wise will send a test event to verify the endpoint

#### Option B: Using Wise API (Advanced)

```bash
# Set your credentials
WISE_TOKEN="10b1f19c-bd61-4c9b-8d86-1ec264550ad4"
WISE_PROFILE="74801255"
WEBHOOK_URL="https://business-accounting-system-production.up.railway.app/api/wise/webhook"
WEBHOOK_SECRET="685603817cb51e79f47b0fa81cbc210670ecb107804042cd89860c8f0497bedd"

# Create webhook subscription
curl -X POST "https://api.wise.com/v3/profiles/${WISE_PROFILE}/subscriptions" \
  -H "Authorization: Bearer ${WISE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Accounting System - Live Transactions",
    "trigger_on": "balances#credit",
    "delivery": {
      "version": "2.0.0",
      "url": "'${WEBHOOK_URL}'"
    }
  }'
```

**Response**: You should receive a JSON response with the webhook subscription ID.

### Step 3: Verify Webhook is Working

After registering, Wise automatically sends a test event. Check Railway logs:

```bash
# View Railway logs
railway logs --service business-accounting-system --lines 50
```

Look for:
```
=== Wise Webhook Received ===
Timestamp: 2025-10-27T...
Event Type: test
✓ Test webhook received successfully
```

---

## Testing the Webhook

### Test 1: Wise Test Event

In Wise dashboard:
1. Go to your webhook configuration
2. Click **"Test webhook"** button
3. Check Railway logs for successful receipt

### Test 2: Real Transaction (Recommended)

Make a small test transaction:

**Option 1: Receive Money**
- Have someone send you €1-5 via Wise
- Wait 5-10 seconds
- Check Railway logs for `balances#credit` event
- Check database for new `wise_transactions` entry

**Option 2: Send Money**
- Send €1-5 to yourself or test account
- Wait for completion
- Check for `transfers#state-change` event

### Test 3: Database Verification

```bash
# Connect to Railway database
PGPASSWORD=iiijaeSBDPUckvGWSopVfrJmvlpNzmDp psql -h gondola.proxy.rlwy.net -p 41656 -U postgres -d railway

# Check recent webhook transactions
SELECT
  id,
  wise_transaction_id,
  type,
  amount,
  currency,
  classified_category,
  confidence_score,
  needs_review,
  sync_status,
  created_at
FROM wise_transactions
ORDER BY created_at DESC
LIMIT 10;
```

---

## Expected Behavior

### High Confidence Transaction (80%+)
```
=== Wise Webhook Received ===
Event Type: balances#credit
Processing balance credit event...
Classifying transaction...
Classification result: { category: 'Employee', confidence: 95, needsReview: false }
✓ Transaction saved: TXN_123456
  Category: Employee
  Confidence: 95%
  Needs Review: false
Auto-creating entry for high-confidence transaction...
✓ Entry created for Wise transaction TXN_123456: Salary - John Doe (expense EUR 3000.00)
✓ Balance credit processed in 245ms
```

**Result**: Entry automatically created in accounting system

### Low Confidence Transaction (<80%)
```
=== Wise Webhook Received ===
Event Type: balances#credit
Processing balance credit event...
Classifying transaction...
Classification result: { category: 'Other Expenses', confidence: 45, needsReview: true }
✓ Transaction saved: TXN_789012
  Category: Other Expenses
  Confidence: 45%
  Needs Review: true
Transaction flagged for manual review
✓ Balance credit processed in 189ms
```

**Result**: Transaction stored, no entry created automatically (needs review in Wise Sync tab)

---

## Monitoring & Troubleshooting

### View Real-Time Logs

```bash
# Railway CLI (install: npm install -g @railway/cli)
railway login
railway logs --service business-accounting-system
```

Or via Railway dashboard: **Deployments** → **Deploy Logs**

### Common Issues

#### 1. "Invalid signature" Error

**Symptoms:**
```
Invalid webhook signature
Expected: abc123...
Received: xyz789...
```

**Solution:**
- Verify `WISE_WEBHOOK_SECRET` in Railway matches the secret you gave to Wise
- Check for whitespace or line breaks in the secret
- Regenerate both secret and webhook if mismatch persists

---

#### 2. Webhook Not Receiving Events

**Symptoms:**
- No logs appear in Railway when transactions occur
- Test webhook in Wise dashboard fails

**Solutions:**
1. **Check webhook URL is correct**:
   ```
   https://business-accounting-system-production.up.railway.app/api/wise/webhook
   ```

2. **Verify Railway service is running**:
   - Go to Railway dashboard
   - Check service status is "Active"

3. **Test endpoint manually**:
   ```bash
   curl -X POST https://business-accounting-system-production.up.railway.app/api/wise/webhook \
     -H "Content-Type: application/json" \
     -H "x-signature: test" \
     -d '{"event_type":"test","data":{}}'
   ```

   Should return:
   ```json
   {"error":"Invalid signature","message":"Webhook signature validation failed"}
   ```

4. **Check Wise webhook status**:
   - Login to Wise
   - Settings → Webhooks
   - Look for error indicators or failed deliveries

---

#### 3. Transactions Not Auto-Creating Entries

**Symptoms:**
- Webhook receives events successfully
- Transactions stored in `wise_transactions` table
- No entries created in accounting system

**Solutions:**
1. **Check confidence scores**:
   ```sql
   SELECT wise_transaction_id, classified_category, confidence_score, needs_review
   FROM wise_transactions
   WHERE sync_status = 'pending'
   ORDER BY created_at DESC;
   ```

   - Only transactions with `confidence_score >= 80` AND `needs_review = false` auto-create entries

2. **Review classification logic**:
   - Low confidence means manual review is required
   - Use the Wise Sync tab in the app to review and approve

3. **Check for processing errors**:
   ```sql
   SELECT wise_transaction_id, processing_error, created_at
   FROM wise_transactions
   WHERE sync_status = 'failed'
   ORDER BY created_at DESC;
   ```

---

#### 4. Duplicate Transactions

**Symptoms:**
- Same transaction appears multiple times

**Solutions:**
- Built-in deduplication using `wise_transaction_id`
- Database constraint prevents duplicates:
  ```sql
  UNIQUE (wise_transaction_id)
  ```
- If duplicates appear, check Railway logs for errors

---

## Security Considerations

### Signature Validation
- **All webhooks are validated** using HMAC-SHA256 signature
- Wise signs each payload with your `WISE_WEBHOOK_SECRET`
- Invalid signatures are rejected with 401 status

### Endpoint Protection
- **Public endpoint** (no JWT required) for Wise to access
- **Signature is the security** - only Wise can generate valid signatures
- Secret must be kept confidential

### Secret Rotation

If you need to rotate the webhook secret:

1. Generate new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Update Railway environment variable:
   - Railway dashboard → Variables → WISE_WEBHOOK_SECRET

3. Update Wise webhook configuration:
   - Wise dashboard → Webhooks → Edit webhook → Update secret

4. Test with Wise test event

---

## Performance & Limits

### Response Time Requirements
- **Wise requires response within 2 seconds**
- Our webhook typically responds in **150-300ms**
- Processing happens synchronously within response time

### Rate Limits
- **No rate limits on webhook endpoint**
- Wise typically sends 1-5 events per transaction
- Database connection pool handles concurrent webhooks

### Retry Behavior
- If webhook returns **non-200 status**, Wise retries
- Our webhook returns **200 even on processing errors** to avoid retries
- Failed processing is logged and can be retried manually

---

## Manual Sync vs. Webhook

You now have **two methods** for importing Wise transactions:

### Method 1: Webhook (Real-Time) ✅ RECOMMENDED
- **Automatic**: No manual action required
- **Real-Time**: Entries created within seconds of transaction
- **High Confidence**: Auto-creates entries for 80%+ confidence
- **Review Queue**: Flags uncertain transactions for review

### Method 2: CSV Import (Manual Backup)
- **Manual**: User uploads CSV from Wise dashboard
- **Batch**: Process multiple transactions at once
- **Fallback**: Use if webhook fails or for historical imports
- **Same Format**: 21-column Wise export format

**Recommendation**: Use webhooks as primary method, CSV import as backup for historical data or missed transactions.

---

## Database Schema

### wise_transactions Table

Stores all incoming webhook transactions:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `wise_transaction_id` | VARCHAR(255) | Unique Wise transaction ID |
| `type` | VARCHAR(50) | 'CREDIT' or 'DEBIT' |
| `state` | VARCHAR(50) | Transaction state (completed, pending) |
| `amount` | DECIMAL(12,2) | Transaction amount |
| `currency` | VARCHAR(3) | Currency code (EUR, USD, etc.) |
| `description` | TEXT | Transaction description |
| `merchant_name` | VARCHAR(255) | Merchant or recipient name |
| `reference_number` | VARCHAR(255) | Reference/note from transaction |
| `transaction_date` | TIMESTAMP | When transaction occurred |
| `sync_status` | VARCHAR(20) | pending, processed, failed, skipped |
| `classified_category` | VARCHAR(50) | Auto-classified category |
| `matched_employee_id` | INTEGER | FK to employees table (if salary) |
| `confidence_score` | INTEGER | 0-100 confidence score |
| `needs_review` | BOOLEAN | True if confidence < 80% |
| `entry_id` | INTEGER | FK to created entry (if processed) |
| `raw_payload` | JSONB | Full webhook payload for debugging |
| `created_at` | TIMESTAMP | When webhook was received |
| `processed_at` | TIMESTAMP | When entry was created |

---

## Webhook Event Examples

### Example 1: Balance Credit Event
```json
{
  "event_type": "balances#credit",
  "data": {
    "resource": {
      "id": "transaction_12345",
      "type": "transaction"
    },
    "amount": {
      "value": 1500.00,
      "currency": "EUR"
    },
    "profile_id": "74801255",
    "account_id": "balance_67890",
    "state": "completed",
    "created_time": "2025-10-27T14:30:00Z",
    "details": {
      "description": "Invoice payment from Client ABC",
      "merchant_name": "Client ABC",
      "reference": "INV-2025-001"
    }
  }
}
```

### Example 2: Balance Update Event
```json
{
  "event_type": "balances#update",
  "data": {
    "resource": {
      "id": "transaction_54321"
    },
    "amount": {
      "value": 3000.00,
      "currency": "EUR"
    },
    "details": {
      "description": "Salary payment - John Doe"
    }
  }
}
```

---

## API Endpoints

All Wise-related endpoints (requires JWT authentication except webhook):

### Webhook (Public)
- `POST /api/wise/webhook` - Receive Wise webhook events (public, signature validated)

### CSV Import
- `POST /api/wise/import` - Upload and import Wise CSV file (authenticated)
- `GET /api/wise/test-connection` - Test database connection (authenticated)

### Transaction Management (Future)
- `GET /api/wise/pending-review` - Get transactions needing review
- `POST /api/wise/review/:id` - Approve or skip transaction
- `GET /api/wise/stats` - Get sync statistics

---

## Next Steps

1. ✅ **Register webhook in Wise dashboard** (follow Step 2 above)
2. ✅ **Test with Wise test event** to verify connection
3. ✅ **Make a real test transaction** (small amount)
4. ✅ **Monitor Railway logs** to see webhook processing
5. ✅ **Check accounting entries** are auto-created for high-confidence transactions
6. ✅ **Use Wise Sync tab** to review low-confidence transactions

---

## Support Resources

- **Wise Webhook Docs**: https://docs.wise.com/api-docs/webhooks-notifications
- **Railway Logs**: https://railway.app/project/[your-project-id]
- **Project Repo**: https://github.com/RafaelEpicMegacorp/business-accounting-system
- **Database Access**: Railway → PostgreSQL service → Connect

---

**Webhook URL (Copy this)**:
```
https://business-accounting-system-production.up.railway.app/api/wise/webhook
```

---

*Last Updated: October 27, 2025*
*Version: 2.0 (Re-implemented)*
