# Wise Webhook Integration - Complete Documentation

## 📚 Documentation Index

Choose the guide that fits your needs:

### 🚀 Quick Start (Recommended)
**File**: `WISE_WEBHOOK_QUICK_START.md`
**Time**: 10-15 minutes
**Best for**: First-time setup with step-by-step instructions

### ✅ Checklist Version
**File**: `WEBHOOK_SETUP_CHECKLIST.md`
**Time**: 5-10 minutes
**Best for**: Quick reference, experienced users

### 🔧 Troubleshooting
**File**: `WEBHOOK_TROUBLESHOOTING.md`
**Best for**: When something isn't working

### 📖 Complete Guide
**File**: `WISE_WEBHOOK_SETUP.md`
**Best for**: Understanding how everything works, production deployment

### 📊 Implementation Summary
**File**: `WISE_INTEGRATION_SUMMARY.md`
**Best for**: Technical overview, what was built

---

## 🎯 What Is This?

This webhook integration allows your accounting system to automatically sync transactions from Wise in real-time.

### Before Webhook Integration
- ❌ Manual PDF imports
- ❌ Balance discrepancies
- ❌ Missing transactions
- ❌ Manual categorization
- ❌ Delayed updates

### After Webhook Integration
- ✅ Real-time automatic sync
- ✅ Accurate balances
- ✅ All transactions captured
- ✅ Smart auto-categorization
- ✅ Instant updates (< 60 seconds)

---

## ⚡ Quick Setup (TL;DR)

1. **Get ngrok**: Sign up at https://dashboard.ngrok.com/signup
2. **Start services**: Backend → ngrok → Frontend
3. **Register webhook**: In Wise settings with ngrok URL
4. **Test**: Make $1 transaction, watch it appear automatically

**Detailed steps**: See `WISE_WEBHOOK_QUICK_START.md`

---

## 🏗️ Architecture Overview

```
Wise Account
    ↓ (webhook event)
ngrok Tunnel (HTTPS)
    ↓
Backend API (:3001)
    ↓ (signature verification)
Database (PostgreSQL)
    ↓
Frontend Dashboard (:5173)
```

### Components Built
1. **Database Tables**: Store webhook events, sync status, transaction mappings
2. **Backend Controller**: Process webhooks, verify signatures, create entries
3. **API Endpoints**: 6 endpoints for webhook management
4. **Frontend Dashboard**: Real-time monitoring and controls
5. **Smart Categorization**: Auto-categorize by merchant patterns

---

## 📋 Prerequisites

### Already Have ✅
- [x] Accounting system installed
- [x] PostgreSQL database running
- [x] Wise account with API token
- [x] Node.js and npm installed
- [x] All webhook code built and tested

### Need to Get 📝
- [ ] ngrok account (free) - https://dashboard.ngrok.com/signup
- [ ] ngrok auth token
- [ ] Wise webhook subscription
- [ ] Wise webhook secret

---

## 🎓 How It Works

### When Money Moves in Wise

1. **Transaction occurs** (someone pays you, you pay someone)
2. **Wise sends webhook** (within seconds)
3. **ngrok forwards** to your local backend
4. **Backend verifies** signature for security
5. **Backend processes** event and creates entry
6. **Smart categorization** assigns correct category
7. **Database stores** transaction with deduplication
8. **Frontend updates** automatically (or on refresh)

### Smart Categorization Examples

**Incoming from "ZIDAN MANAGEMENT GROUP"** → Income: Client Payment
**Outgoing to Upwork** → Expense: Salary (recruiting)
**Payment to "Maryana"** → Expense: Salary (linked to employee)
**Charge from "Notion"** → Expense: Software
**Purchase from "Apple"** → Expense: Equipment
**Payment to "WeWork"** → Expense: Office Rent
**Uber Eats charge** → Expense: Business Meals

---

## 🔒 Security

### Built-in Protection
- ✅ **Webhook signature verification** (HMAC-SHA256)
- ✅ **HTTPS required** (enforced by Wise)
- ✅ **Transaction deduplication** (prevents double-imports)
- ✅ **Error logging** (audit trail)
- ✅ **Secret stored in .env** (not in code)

### What We DON'T Do
- ❌ Store credit card numbers
- ❌ Store Wise passwords
- ❌ Send data to third parties
- ❌ Make transfers via API

---

## 💰 Cost Breakdown

### Free Tier (Perfect for Testing)
- **ngrok**: Free (with session limits)
- **Wise API**: Free (read-only)
- **PostgreSQL**: Free (local)
- **Development**: Free

**Total**: $0/month

### Production (When Ready)
- **ngrok Pro**: $8/month (permanent URL)
- **Heroku Basic**: $7/month (or use VPS)
- **Domain**: $12/year (optional)

**Total**: ~$15-20/month

---

## 📊 Monitoring Dashboard

Access: **http://localhost:5173** → Click **"Wise Sync"** tab

### What You See
1. **Webhook Status**
   - Enabled/Disabled
   - Profile ID
   - Last webhook received time

2. **Event Statistics**
   - Total events received
   - Successfully processed
   - Failed (with error details)

3. **Current Balances**
   - USD, EUR, GBP, PLN
   - Synced from Wise API

4. **Recent Events Table**
   - Event type
   - Status (Pending/Processed/Error)
   - Timestamps
   - Error messages if any

5. **Manual Controls**
   - Process pending events button
   - Refresh data button
   - Balance update button

---

## 🔄 Development Workflow

### Daily Development
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: ngrok
/tmp/ngrok http 3001

# Terminal 3: Frontend
cd frontend && npm run dev
```

### After Computer Restart
1. Repeat above commands
2. **Get new ngrok URL** (it changes on free tier)
3. **Update webhook in Wise** with new URL
4. Continue working

### Production Ready
- Deploy to Heroku/VPS
- Get permanent domain
- Update webhook URL one last time
- Never worry about restarts again!

---

## 🧪 Testing

### Initial Test
1. Make $1 test transaction
2. Wait 60 seconds
3. Check Wise Sync dashboard
4. Verify entry created
5. Check category is correct

### Edge Cases to Test
- ✅ Currency conversion (EUR → USD entry)
- ✅ Employee payment (auto-links to employee)
- ✅ Duplicate transaction (system prevents)
- ✅ Large amount (check no truncation)
- ✅ Special characters in description

### Verification
```bash
# Check webhook received
curl http://localhost:3001/api/wise/events?limit=5

# Check processing succeeded
curl http://localhost:3001/api/wise/status

# Check entry created
psql -U accounting_user -d accounting_db -c \
  "SELECT * FROM entries WHERE wise_transaction_id IS NOT NULL ORDER BY created_at DESC LIMIT 5;"
```

---

## 🎯 Success Checklist

After setup, you should have:

### Running Services ✅
- [ ] Backend server on port 3001
- [ ] ngrok tunnel forwarding to backend
- [ ] Frontend server on port 5173
- [ ] PostgreSQL database running

### Configuration ✅
- [ ] Webhook registered in Wise
- [ ] Webhook URL matches ngrok URL
- [ ] Webhook secret in `.env` file
- [ ] Events subscribed: credit, debit, state-change

### Testing ✅
- [ ] Health endpoint responds
- [ ] Wise status endpoint returns data
- [ ] Dashboard loads without errors
- [ ] Test transaction appears automatically
- [ ] Event shows "Processed" status
- [ ] Correct category assigned

---

## 🚀 Next Steps

### Phase 1: Testing (Current)
- ✅ Complete webhook setup
- ✅ Test with small transactions
- ✅ Monitor for 1 week
- ✅ Fine-tune categorization rules

### Phase 2: Optimization
- [ ] Add more category keywords
- [ ] Set up email notifications
- [ ] Create monthly reports
- [ ] Add bulk import for historical data

### Phase 3: Production
- [ ] Deploy to Heroku or VPS
- [ ] Get permanent domain
- [ ] Update webhook to production URL
- [ ] Set up monitoring alerts

---

## 📞 Support Resources

### Documentation
- Quick Start: `WISE_WEBHOOK_QUICK_START.md`
- Checklist: `WEBHOOK_SETUP_CHECKLIST.md`
- Troubleshooting: `WEBHOOK_TROUBLESHOOTING.md`
- Full Guide: `WISE_WEBHOOK_SETUP.md`

### External Resources
- Wise API Docs: https://docs.wise.com/api-docs/
- ngrok Docs: https://ngrok.com/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/

### Quick Commands
```bash
# Health check
curl http://localhost:3001/health

# Webhook status
curl http://localhost:3001/api/wise/status

# Recent events
curl http://localhost:3001/api/wise/events?limit=10

# Process pending
curl -X POST http://localhost:3001/api/wise/process-pending
```

---

## 🎉 You're Ready!

1. Start with **`WISE_WEBHOOK_QUICK_START.md`**
2. Follow the step-by-step instructions
3. Use **`WEBHOOK_SETUP_CHECKLIST.md`** for quick reference
4. If stuck, check **`WEBHOOK_TROUBLESHOOTING.md`**

**Estimated setup time**: 10-15 minutes
**Skill level required**: Basic terminal usage
**Cost**: Free for testing

---

**Questions?** All the answers are in the documentation files listed above!
