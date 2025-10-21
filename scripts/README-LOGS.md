# 📋 Real-Time Log Viewing

Quick guide to viewing Railway logs in real-time.

## 🚀 Quick Start (Easiest)

```bash
# From backend directory
cd backend
npm run logs              # Show all logs
npm run logs:webhook      # Show only webhook logs
npm run logs:error        # Show only errors
```

## 📝 Usage Options

### Option 1: NPM Scripts (Recommended)
```bash
cd backend
npm run logs              # All logs
npm run logs:webhook      # Filter for webhooks/Wise
npm run logs:error        # Filter for errors
```

### Option 2: Direct Script Execution
```bash
# Node.js version (with filtering)
node scripts/logs.js              # All logs
node scripts/logs.js webhook      # Webhook logs only
node scripts/logs.js error        # Errors only

# Bash version (simple)
./scripts/watch-logs.sh           # All logs, no filtering
```

### Option 3: Raw Railway CLI
```bash
railway logs --service business-accounting-system
```

## 📦 Requirements

**Railway CLI must be installed:**
```bash
# Install
npm install -g @railway/cli
# OR
brew install railway

# Login
railway login
```

## 🎯 What You'll See

### All Logs (`npm run logs`)
Shows everything from the Railway deployment:
- Server startup messages
- API requests
- Database queries
- Errors
- Webhook events
- All console.log output

### Webhook Logs (`npm run logs:webhook`)
Filters for Wise webhook events:
```
📨 ╔══════════════════════════════════════════╗
📨 ║     WISE WEBHOOK RECEIVED                ║
📨 ╚══════════════════════════════════════════╝
📨 📅 Timestamp: 2025-10-21T07:15:23.456Z
📨 📦 Payload: { ... }
```

### Error Logs (`npm run logs:error`)
Shows only errors and warnings:
```
🚨 ❌ Error: Database connection failed
🚨 ERROR: Signature validation failed
```

## ⏹️ Stop Watching

Press `Ctrl+C` to stop the log viewer anytime.

## 💡 Tips

1. **Multiple terminals**: Run `npm run logs` in one terminal while testing in another
2. **Filter smart**: Use `logs:webhook` when testing webhooks to reduce noise
3. **Debugging**: Use `logs:error` to quickly spot issues
4. **Full context**: Use `npm run logs` (no filter) when you need everything

## 🧪 Testing Webhooks

To test webhooks and see the logs:

**Terminal 1** - Watch logs:
```bash
cd backend
npm run logs:webhook
```

**Terminal 2** - Send test webhook:
```bash
node scripts/test-webhook-no-sig.js
```

You'll see the webhook appear in Terminal 1 immediately!

## 📖 Alternative: Railway Dashboard

If you prefer a web interface:
1. Go to: https://railway.app/
2. Select: business-accounting-system
3. Click: Deployments → Latest → Logs
4. Search for: `WISE WEBHOOK RECEIVED`

---

*Logs update in real-time - no refresh needed!*
