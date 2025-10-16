# Wise Webhook Setup - Quick Checklist

Copy-paste these commands in order. ✅ check each step as you complete it.

---

## 📋 Pre-Flight Check

- [x] Backend code installed
- [x] Database migration applied
- [x] ngrok downloaded at `/tmp/ngrok`
- [ ] ngrok auth token obtained
- [ ] Backend server running
- [ ] ngrok tunnel running
- [ ] Webhook registered in Wise
- [ ] Webhook secret added to .env
- [ ] Test transaction completed

---

## ⚡ Quick Commands

### 1️⃣ Get ngrok Auth Token
1. Sign up: https://dashboard.ngrok.com/signup
2. Get token: https://dashboard.ngrok.com/get-started/your-authtoken
3. Run (replace YOUR_TOKEN):
```bash
/tmp/ngrok config add-authtoken YOUR_TOKEN
```

### 2️⃣ Start Backend
```bash
cd /Users/rafael/Windsurf/accounting/backend
npm run dev
```
**✅ Wait for**: `Server running on http://localhost:3001`

### 3️⃣ Test Backend (in new terminal)
```bash
curl http://localhost:3001/health
```
**✅ Should see**: `{"status":"ok"...}`

### 4️⃣ Start ngrok (in new terminal)
```bash
/tmp/ngrok http 3001
```
**✅ Copy the HTTPS URL** from the `Forwarding` line
Example: `https://abc123.ngrok-free.app`

### 5️⃣ Register Webhook in Wise
1. Go to: Wise → Settings → Integrations → Webhooks
2. Create subscription:
   - **URL**: `https://YOUR-NGROK-URL/api/wise/webhook`
   - **Profile**: `74801255`
   - **Events**: `balances#credit`, `balances#debit`, `transfers#state-change`
3. **✅ Copy the webhook secret** (looks like: `wh_secret_...`)

### 6️⃣ Add Secret to .env
```bash
cd /Users/rafael/Windsurf/accounting/backend
echo "WISE_WEBHOOK_SECRET=YOUR_SECRET_HERE" >> .env
```
Replace `YOUR_SECRET_HERE` with the actual secret from Wise.

### 7️⃣ Restart Backend
Press `Ctrl+C` in backend terminal, then:
```bash
npm run dev
```

### 8️⃣ Start Frontend (in new terminal)
```bash
cd /Users/rafael/Windsurf/accounting/frontend
npm run dev
```
**✅ Open**: http://localhost:5173

### 9️⃣ Test Webhook
1. Open browser: http://localhost:5173
2. Click **"Wise Sync"** tab
3. Make a $1 test transaction in Wise
4. **✅ Wait 60 seconds** and refresh
5. Should see event in "Recent Webhook Events"

---

## 🔧 If Something Breaks

### Backend won't start
```bash
# Check if port 3001 is already in use
lsof -ti:3001 | xargs kill -9
# Then restart backend
```

### ngrok error "ERR_NGROK_4018"
```bash
# Re-run auth command with your token
/tmp/ngrok config add-authtoken YOUR_TOKEN
```

### Webhook events not appearing
1. Check ngrok is running (look for `Forwarding` line)
2. Check webhook URL in Wise matches your ngrok URL
3. Open http://127.0.0.1:4040 to see incoming webhook calls
4. Check backend terminal for error messages

### Events show "Error" status
1. Check `WISE_WEBHOOK_SECRET` in `.env` matches Wise
2. Restart backend after updating `.env`
3. Check backend terminal for error details

---

## 📱 Contact URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |
| Health Check | http://localhost:3001/health |
| Wise Status | http://localhost:3001/api/wise/status |
| ngrok Dashboard | http://127.0.0.1:4040 |
| ngrok Signup | https://dashboard.ngrok.com/signup |
| Wise Settings | https://wise.com/settings |

---

## 🎯 Success Criteria

After completing all steps, you should have:
- ✅ 3 terminal windows running (backend, ngrok, frontend)
- ✅ Frontend showing Wise Sync dashboard
- ✅ Webhook registered in Wise
- ✅ Test transaction appears automatically in app
- ✅ Event status shows "Processed" (green)

---

**⏱️ Estimated Time**: 10-15 minutes
**💰 Cost**: Free (ngrok free tier)
**🔄 Repeat Setup After**: Computer restart (ngrok URL changes)
