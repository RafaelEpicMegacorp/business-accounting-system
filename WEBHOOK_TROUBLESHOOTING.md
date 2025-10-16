# Wise Webhook Troubleshooting Guide

Quick fixes for common webhook setup issues.

---

## 🚨 Problem: Backend Won't Start

### Error: "Port 3001 already in use"
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9

# Wait 2 seconds
sleep 2

# Restart backend
cd /Users/rafael/Windsurf/accounting/backend
npm run dev
```

### Error: "Database connection failed"
```bash
# Check if PostgreSQL is running
pg_isready

# If not running, start it
brew services start postgresql

# Test database connection
psql -U accounting_user -d accounting_db -c "SELECT 1"
```

### Error: "Cannot find module 'axios'"
```bash
# Reinstall dependencies
cd /Users/rafael/Windsurf/accounting/backend
npm install
```

---

## 🚨 Problem: ngrok Issues

### Error: "ERR_NGROK_4018: authentication failed"
```bash
# You need to add your auth token
# Get it from: https://dashboard.ngrok.com/get-started/your-authtoken
/tmp/ngrok config add-authtoken YOUR_TOKEN_HERE
```

### Error: "ngrok: command not found"
```bash
# Use the full path
/tmp/ngrok http 3001
```

### Problem: ngrok URL keeps changing
**This is normal for free tier.**

After each restart:
1. Note the new ngrok URL from `Forwarding` line
2. Update webhook in Wise Settings → Integrations → Webhooks
3. Edit existing subscription with new URL

**Solution for permanent URL**: Upgrade to ngrok Pro ($8/month)

### Problem: ngrok tunnel closes unexpectedly
```bash
# Check if you're still logged in
/tmp/ngrok config check

# If needed, re-authenticate
/tmp/ngrok config add-authtoken YOUR_TOKEN
```

---

## 🚨 Problem: Webhook Not Receiving Events

### Check 1: Verify ngrok is running
```bash
# Should see "Forwarding" line
# If not, restart ngrok
/tmp/ngrok http 3001
```

### Check 2: Test webhook endpoint is accessible
```bash
# Get your ngrok URL from the Forwarding line
# Replace [NGROK-URL] with your actual URL
curl https://[NGROK-URL]/api/wise/webhook
```

**Expected**: Some response (even an error is OK - means endpoint is reachable)
**Problem**: "Could not resolve host" → ngrok is not running

### Check 3: View ngrok traffic
1. Open browser: http://127.0.0.1:4040
2. Make a test transaction in Wise
3. Should see webhook POST requests appearing
4. Click on request to see details

**If you see 401 Unauthorized**: Webhook secret mismatch (see below)
**If you see nothing**: Webhook not registered correctly in Wise

### Check 4: Verify webhook in Wise
1. Go to Wise → Settings → Integrations → Webhooks
2. Check:
   - URL matches your current ngrok URL + `/api/wise/webhook`
   - Events include: `balances#credit`, `balances#debit`, `transfers#state-change`
   - Status is "Active" (not paused)

---

## 🚨 Problem: Events Show "Error" Status

### Check webhook secret
```bash
# View current secret in .env
cd /Users/rafael/Windsurf/accounting/backend
grep WISE_WEBHOOK_SECRET .env
```

**Should see**: `WISE_WEBHOOK_SECRET=wh_secret_...something`
**If empty**: Add the secret from Wise

**If wrong**: Update it:
```bash
# Open .env
nano .env

# Update the line:
WISE_WEBHOOK_SECRET=wh_secret_YOUR_ACTUAL_SECRET

# Save: Ctrl+X, then Y, then Enter

# MUST restart backend
# Press Ctrl+C in backend terminal, then:
npm run dev
```

### Check error message in dashboard
1. Open http://localhost:5173
2. Click "Wise Sync" tab
3. Look at "Recent Webhook Events" table
4. Check error message for failed events

**Common errors**:
- "Invalid signature" → Wrong webhook secret
- "Database error" → Database connection issue
- "Transaction already exists" → Duplicate (OK, system prevented double-import)

### Manually retry failed events
```bash
curl -X POST http://localhost:3001/api/wise/process-pending
```

---

## 🚨 Problem: Transactions Not Appearing

### Check 1: Event was received
```bash
# Check recent webhook events
curl http://localhost:3001/api/wise/events?limit=10
```

**Should see**: JSON with events
**If empty**: Webhooks not being received (see "Webhook Not Receiving Events" above)

### Check 2: Event was processed
```bash
# Check events that are still pending
curl http://localhost:3001/api/wise/events?processed=false
```

**If you see pending events**: Process them manually:
```bash
curl -X POST http://localhost:3001/api/wise/process-pending
```

### Check 3: Entry was created in database
```bash
# Connect to database
psql -U accounting_user -d accounting_db

# Check recent entries
SELECT id, type, category, description, total, entry_date
FROM entries
WHERE wise_transaction_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

# Exit
\q
```

### Check 4: Frontend is showing entries
1. Refresh browser: http://localhost:5173
2. Click appropriate tab:
   - **Income** for incoming money
   - **Expenses** for outgoing money
   - **Salaries** for employee payments
3. Check date filters aren't hiding the entry

---

## 🚨 Problem: Wrong Categorization

### View auto-categorization logic
The system categorizes based on merchant name and description:

**Salary**: Upwork, Asif, Maryana, Abhijeet
**Software**: Notion, GitHub, ChatGPT, AWS, Vercel
**Equipment**: Laptop, computer, monitor, keyboard
**Office Rent**: Coworking, WeWork, Regus, office
**Business Meals**: Restaurant, cafe, coffee, food
**Travel**: Flight, hotel, Airbnb, Uber, taxi

### Manually recategorize an entry
1. Go to appropriate tab (Income/Expenses/Salaries)
2. Click edit button on the entry
3. Change category
4. Save

### Add custom categorization rules
File: `/Users/rafael/Windsurf/accounting/backend/src/controllers/wiseWebhookController.js`

Find the `categorizeTransaction` method (around line 280) and add your keywords.

---

## 🚨 Problem: Balance Mismatch

### Update balances from Wise
```bash
curl http://localhost:3001/api/wise/balances
```

This fetches current balances from Wise API and updates the dashboard.

### Compare with Wise app
1. Open Wise app or website
2. Check balances for USD, EUR, GBP, PLN
3. Compare with "Wise Sync" dashboard
4. If different, wait for next transaction to sync

### Check for missing transactions
```bash
# View sync status
curl http://localhost:3001/api/wise/status
```

Check:
- `total_events_received` - How many webhook events received
- `total_events_processed` - How many successfully created entries
- `total_events_failed` - How many had errors

If `total_events_failed` > 0, process them:
```bash
curl -X POST http://localhost:3001/api/wise/process-pending
```

---

## 🔍 Advanced Debugging

### View backend logs in real-time
```bash
# In backend terminal, you see logs live
# Look for lines like:
# "📥 Received webhook event: balances#credit"
# "✅ Created entry 123 from webhook evt_..."
# "❌ Error processing webhook..."
```

### View all webhook events in database
```bash
psql -U accounting_user -d accounting_db

SELECT
  id,
  event_type,
  processed,
  error_message,
  received_at
FROM wise_webhook_events
ORDER BY received_at DESC
LIMIT 20;

\q
```

### Check webhook configuration
```bash
psql -U accounting_user -d accounting_db

SELECT * FROM wise_sync_status;

\q
```

### View transaction mapping
```bash
psql -U accounting_user -d accounting_db

SELECT
  wt.wise_transaction_id,
  wt.transaction_type,
  wt.amount,
  wt.currency,
  wt.status,
  e.id as entry_id,
  e.description
FROM wise_transactions wt
LEFT JOIN entries e ON wt.entry_id = e.id
ORDER BY wt.created_at DESC
LIMIT 10;

\q
```

---

## 📞 Emergency Reset

### If everything is broken, start fresh:

```bash
# 1. Stop all running processes
# Press Ctrl+C in all terminal windows

# 2. Kill any lingering processes
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
pkill -f ngrok

# 3. Clear webhook events (optional - keeps old data)
psql -U accounting_user -d accounting_db -c "TRUNCATE wise_webhook_events CASCADE;"

# 4. Restart everything from scratch
# Follow WEBHOOK_SETUP_CHECKLIST.md again
```

---

## ✅ Health Check Commands

Run these to verify everything is working:

```bash
# Backend health
curl http://localhost:3001/health

# Wise API connection
curl http://localhost:3001/api/wise/status

# Recent webhook events
curl http://localhost:3001/api/wise/events?limit=5

# Database connection
psql -U accounting_user -d accounting_db -c "SELECT COUNT(*) FROM wise_webhook_events;"

# ngrok tunnel status
curl http://127.0.0.1:4040/api/tunnels
```

All should return successful responses.

---

## 📚 Log Files

If you need to check logs later:

**Backend logs**: Displayed in terminal running `npm run dev`
**ngrok logs**: Check http://127.0.0.1:4040 web interface
**Database logs**: Check PostgreSQL logs (location varies by installation)

---

## 🆘 Still Stuck?

1. Check the detailed guide: `WISE_WEBHOOK_SETUP.md`
2. Check Wise API docs: https://docs.wise.com/api-docs/
3. Check ngrok docs: https://ngrok.com/docs
4. Look at the Wise Sync dashboard for error messages
5. Check backend terminal for processing logs

**Most common fix**: Restart everything in the correct order:
1. Backend server
2. ngrok tunnel
3. Update webhook URL in Wise if ngrok URL changed
4. Frontend server
