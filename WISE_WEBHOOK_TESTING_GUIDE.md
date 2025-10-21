# 🔔 Wise Webhook Testing Guide

**Date**: October 21, 2025
**Webhook URL**: https://business-accounting-system-production.up.railway.app/api/wise/webhook

---

## 📋 What You'll See

When Wise calls your webhook, you'll see:
- **Full HTTP headers** (including signature)
- **Complete payload** (event data from Wise)
- **Transaction details** (if it's a transaction event)
- **Processing status** (validation, parsing, background processing)

---

## 🚀 Quick Start - Testing the Webhook

### Option 1: Real-Time Monitoring (Recommended)

**Step 1**: Start the monitoring script
```bash
node scripts/monitor-wise-webhooks.js
```

You'll see:
```
╔══════════════════════════════════════════════════════════════════════════════╗
║                      WISE WEBHOOK MONITOR                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

🔍 Monitoring Railway logs for Wise webhook calls...
📋 Showing webhook data in real-time

💡 Trigger a test webhook from Wise dashboard to see it appear here

⏹️  Press Ctrl+C to stop monitoring
```

**Step 2**: Trigger a test webhook from Wise

1. Go to: https://wise.com/settings/webhooks (or wherever you manage webhooks)
2. Find your webhook subscription
3. Click "Send test event" or similar button
4. Watch the script output show the webhook data!

---

### Option 2: Manual Log Viewing

If you don't want to run the monitoring script:

**Railway Dashboard**:
1. Go to: https://railway.app/
2. Select your project: `business-accounting-system`
3. Click "Deployments" → Latest deployment
4. View logs
5. Look for lines with: `WISE WEBHOOK RECEIVED`

**Railway CLI**:
```bash
railway logs --service business-accounting-system
```

Then search for webhook events in the output.

---

## 🧪 How to Trigger Test Webhooks

### Method 1: From Wise Dashboard
1. Login to Wise: https://wise.com
2. Go to Settings → API & Webhooks
3. Find your webhook subscription
4. Click "Test" or "Send test event"
5. Select event type (e.g., `transfers#state-change`)
6. Click "Send"

### Method 2: Real Transaction
Make a real transaction on Wise (even a small internal transfer) and Wise will automatically call your webhook.

---

## 📊 Example Webhook Output

When monitoring, you'll see output like this:

```
🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔
📨 NEW WEBHOOK RECEIVED!
🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔

╔══════════════════════════════════════════════════════════════════════════════╗
║                         WISE WEBHOOK RECEIVED                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

📅 Timestamp: 2025-10-21T06:45:23.456Z
🌐 IP Address: 52.34.12.123
🔗 URL: /api/wise/webhook
📨 Method: POST

📋 Headers:
  host: business-accounting-system-production.up.railway.app
  x-signature-sha256: 8a7f9e2d3c4b5a6e1f2d3c4b5...
  content-type: application/json
  content-length: 1234
  user-agent: Wise-Webhook/1.0

📦 Payload:
{
  "event_type": "transfers#state-change",
  "subscription_id": "12345678-1234-1234-1234-123456789012",
  "sent_at": "2025-10-21T06:45:23.000Z",
  "data": {
    "resource": {
      "type": "transfer",
      "id": 123456789,
      "profile_id": 74801125,
      "account_id": 987654321,
      "status": "outgoing_payment_sent"
    },
    "current_state": "outgoing_payment_sent",
    "previous_state": "processing",
    "occurred_at": "2025-10-21T06:45:00.000Z"
  }
}

────────────────────────────────────────────────────────────────────────────────

🔐 Signature Validation:
✅ Signature valid

⚙️  Parsing webhook payload...
📝 Transaction ID: T-123456789
💰 Amount: USD 100.00
📊 Type: CREDIT
📅 Date: 2025-10-21

🆕 New transaction - Processing in background
✅ Responding with 200 OK (processing asynchronously)

🔄 Starting background processing...

────────────────────────────────────────────────────────────────────────────────
⏰ Waiting for next webhook...
```

---

## 🔧 Troubleshooting

### Script shows "Railway CLI not found"

**Install Railway CLI**:
```bash
# Using npm
npm install -g @railway/cli

# Or using Homebrew (macOS)
brew install railway
```

**Login to Railway**:
```bash
railway login
```

**Link to project** (if needed):
```bash
cd /Users/rafael/Windsurf/accounting
railway link
```

### No webhooks appearing

**Check webhook configuration**:
1. Verify webhook is registered in Wise
2. Verify webhook URL is correct: https://business-accounting-system-production.up.railway.app/api/wise/webhook
3. Check webhook is "active" in Wise dashboard

**Trigger a test**:
- Send a test event from Wise dashboard
- Or make a small transaction to trigger a real event

### Signature validation fails

**Check WISE_WEBHOOK_SECRET**:
```bash
railway variables --service business-accounting-system
```

Ensure `WISE_WEBHOOK_SECRET` matches the secret shown in Wise webhook settings.

---

## 📚 Webhook Event Types

Wise can send various event types. Common ones:

| Event Type | Description |
|------------|-------------|
| `transfers#state-change` | Transfer status changed (processing → sent → completed) |
| `balance-deposits#status-change` | Incoming payment received |
| `balance-account-transactions#created` | New transaction created |
| `test` | Test event (sent when you click "Test" button) |

---

## 🔐 Security Notes

### Signature Validation

The webhook controller automatically validates signatures using `WISE_WEBHOOK_SECRET`:
- ✅ Valid signature → Process webhook
- ❌ Invalid signature → Reject with 401

### Test Mode

During webhook registration, Wise sends test requests:
- Empty payloads → Returns 200 OK
- `X-Test-Notification: true` header → Returns 200 OK
- `event_type: "test"` → Returns 200 OK

All of these are handled automatically and logged.

---

## 📖 What Happens After Webhook is Received

1. **Validation**: Signature check, payload validation
2. **Duplicate Check**: Skip if transaction already processed
3. **Quick Response**: Return 200 OK within 2 seconds (Wise requirement)
4. **Background Processing**:
   - Classify transaction (category, employee matching)
   - Save to `wise_transactions` table
   - Auto-create entry if confidence ≥ 80%
   - Or flag for manual review if confidence < 80%

---

## 🎯 Next Steps After Testing

Once you see webhooks working:

1. **Register webhook in Wise** (if not already done)
   - Event type: `balance-account-transactions#created`
   - URL: https://business-accounting-system-production.up.railway.app/api/wise/webhook
   - Secret: Generate and save in Railway as `WISE_WEBHOOK_SECRET`

2. **Test with real transaction**
   - Make a small transfer
   - Watch webhook fire
   - Verify transaction appears in database

3. **Monitor performance**
   - Check response times (<2 seconds for 200 OK)
   - Verify classification accuracy
   - Review entries created automatically

---

## 📞 Need Help?

- **Wise Webhook Docs**: https://docs.wise.com/api-docs/webhooks-notifications
- **Railway Logs**: https://railway.app/ → Your project → Logs
- **Database Check**: Run `GET /api/wise/stats` to see transaction counts

---

*Happy webhook testing!* 🚀
