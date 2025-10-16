# Wise Webhook Setup - Quick Start Guide

**Time needed**: 10-15 minutes
**Cost**: Free (using ngrok free tier)

## Prerequisites Checklist

- [x] Backend server code ready
- [x] Database migration applied
- [x] Wise API token configured
- [x] ngrok downloaded at `/tmp/ngrok`
- [ ] ngrok auth token (you'll get this in Step 1)
- [ ] Wise webhook secret (you'll get this in Step 3)

---

## Step 1: Set Up ngrok Account (2 minutes)

### 1.1 Sign Up for ngrok
1. Open your browser and go to: **https://dashboard.ngrok.com/signup**
2. Sign up with your email (or use GitHub/Google)
3. **Free tier is perfect** - no credit card needed

### 1.2 Get Your Auth Token
1. After signing up, you'll be redirected to: **https://dashboard.ngrok.com/get-started/your-authtoken**
2. You'll see a command like:
   ```
   ngrok config add-authtoken 2abc...xyz123
   ```
3. **Copy that entire command** (including the token)

### 1.3 Configure ngrok
Open your terminal and run:
```bash
# Use the command you copied (it will look like this but with YOUR token)
/tmp/ngrok config add-authtoken YOUR_TOKEN_HERE
```

You should see:
```
Authtoken saved to configuration file: /Users/rafael/.ngrok2/ngrok.yml
```

✅ **ngrok is now configured!**

---

## Step 2: Start Your Servers (2 minutes)

### 2.1 Start Backend Server
```bash
cd /Users/rafael/Windsurf/accounting/backend
npm run dev
```

Wait for:
```
Server running on http://localhost:3001
```

**Keep this terminal open!** Open a new terminal for the next steps.

### 2.2 Verify Backend is Running
In a NEW terminal:
```bash
curl http://localhost:3001/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

✅ **Backend is ready!**

---

## Step 3: Start ngrok Tunnel (1 minute)

### 3.1 Start ngrok
In your second terminal:
```bash
/tmp/ngrok http 3001
```

You'll see output like:
```
Session Status     online
Account            Your Name (Plan: Free)
Version            3.x.x
Region             United States (us)
Latency            -
Web Interface      http://127.0.0.1:4040
Forwarding         https://abc123def456.ngrok-free.app -> http://localhost:3001

Connections        ttl     opn     rt1     rt5     p50     p90
                   0       0       0.00    0.00    0.00    0.00
```

### 3.2 Copy Your Webhook URL
**IMPORTANT**: Look for the line starting with `Forwarding` and copy the HTTPS URL.

Example: `https://abc123def456.ngrok-free.app`

Your webhook URL will be:
```
https://abc123def456.ngrok-free.app/api/wise/webhook
```

**Keep this terminal open!** ngrok must stay running.

✅ **Public webhook URL created!**

---

## Step 4: Register Webhook in Wise (3-5 minutes)

### 4.1 Open Wise Webhooks Settings
1. Log in to **https://wise.com**
2. Click your profile picture → **Settings**
3. Go to **Integrations** section
4. Click **Webhooks** (or **Subscriptions**)

### 4.2 Create New Webhook Subscription
1. Click **"Create Subscription"** or **"Add Webhook"**
2. Fill in the form:

   **Webhook URL**:
   ```
   https://[YOUR-NGROK-URL]/api/wise/webhook
   ```
   Example: `https://abc123def456.ngrok-free.app/api/wise/webhook`

   **Profile ID**: `74801255` (your profile ID)

   **Events to subscribe to** (check all 3):
   - ✅ `balances#credit` - Incoming transfers
   - ✅ `balances#debit` - Outgoing payments
   - ✅ `transfers#state-change` - Transfer status updates

3. Click **"Create"** or **"Save"**

### 4.3 Copy the Webhook Secret
After creating the subscription, Wise will show you a **webhook secret**.

**IMPORTANT**: Copy this secret - you'll need it in the next step.

Example: `wh_secret_abc123xyz789...`

✅ **Webhook registered with Wise!**

---

## Step 5: Add Webhook Secret to Your App (2 minutes)

### 5.1 Update .env File
Open the backend `.env` file:
```bash
cd /Users/rafael/Windsurf/accounting/backend
nano .env
```

Find the line:
```
WISE_WEBHOOK_SECRET=
```

Add your secret:
```
WISE_WEBHOOK_SECRET=wh_secret_abc123xyz789...
```

Save and exit (Ctrl+X, then Y, then Enter)

### 5.2 Restart Backend Server
Go back to the terminal running your backend and:
1. Press `Ctrl+C` to stop it
2. Start it again:
   ```bash
   npm run dev
   ```

✅ **Webhook secret configured!**

---

## Step 6: Start Frontend & Test (3 minutes)

### 6.1 Start Frontend Server
In a NEW terminal (third one):
```bash
cd /Users/rafael/Windsurf/accounting/frontend
npm run dev
```

Wait for:
```
Local:   http://localhost:5173/
```

### 6.2 Open Wise Sync Dashboard
1. Open browser: **http://localhost:5173**
2. Click the **"Wise Sync"** tab

You should see:
- Profile ID: 74801255
- Webhook Status: No (it will update after first event)
- Event Statistics: All zeros
- Recent Webhook Events: Empty table

### 6.3 Make a Test Transaction
**Option A: Self-Transfer (Recommended)**
1. Open Wise app or website
2. Transfer $1-5 from one currency to another
3. Or send money to yourself

**Option B: Ask Someone to Send You $1**
- Use your Wise account email or phone

### 6.4 Watch the Magic! ✨
Within 30-60 seconds:
1. Refresh the Wise Sync dashboard
2. You should see:
   - ✅ New event in "Recent Webhook Events" table
   - ✅ Status changes from "Pending" → "Processed"
3. Click **"Income"** or **"Expenses"** tab
4. Your test transaction should appear **automatically**!

---

## Troubleshooting

### ngrok Authentication Failed
```
ERR_NGROK_4018: authentication failed
```
**Solution**: Run the auth token command again:
```bash
/tmp/ngrok config add-authtoken YOUR_TOKEN
```

### Backend Connection Refused
```
Failed to connect to localhost:3001
```
**Solution**: Make sure backend is running:
```bash
cd /Users/rafael/Windsurf/accounting/backend
npm run dev
```

### Webhook Events Not Appearing
1. **Check ngrok is running**: Look for the `Forwarding` line
2. **Check webhook URL in Wise**: Make sure it matches your ngrok URL
3. **Check webhook secret**: Verify it's correctly added to `.env`
4. **View ngrok traffic**: Open http://127.0.0.1:4040 to see incoming requests

### Event Shows "Error" Status
1. Click **"Wise Sync"** tab
2. Look at the error message in the Recent Events table
3. Common fixes:
   - Wrong webhook secret → Update `.env` and restart backend
   - Database error → Check database is running

---

## Quick Reference

### Terminal Windows You Should Have Open
1. **Terminal 1**: Backend server (`npm run dev`)
2. **Terminal 2**: ngrok tunnel (`/tmp/ngrok http 3001`)
3. **Terminal 3**: Frontend server (`npm run dev`)

### Important URLs
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Backend Health**: http://localhost:3001/health
- **Wise Status**: http://localhost:3001/api/wise/status
- **ngrok Dashboard**: http://127.0.0.1:4040
- **Your Public Webhook**: https://[your-ngrok-url]/api/wise/webhook

### Stopping Everything
```bash
# In each terminal, press:
Ctrl+C
```

### Restarting After Computer Reboot
1. Start backend: `cd backend && npm run dev`
2. Start ngrok: `/tmp/ngrok http 3001`
3. **Get NEW ngrok URL** (it changes each time)
4. **Update webhook in Wise** with new URL
5. Start frontend: `cd frontend && npm run dev`

---

## What Happens After Setup?

### Automatic Sync
Every time money moves in your Wise account:
1. Wise sends webhook event to your app
2. App processes the event automatically
3. Creates accounting entry with smart categorization
4. Links to employees if it's a salary payment
5. Updates balances

### Smart Categorization
Your transactions are automatically categorized:
- **Income**: Client payments, other income
- **Salary**: Upwork, employee names (Asif, Maryana, Abhijeet)
- **Software**: Notion, GitHub, ChatGPT, AWS, etc.
- **Equipment**: Laptop, computer, monitor, etc.
- **Office Rent**: Coworking, WeWork, office spaces
- **Business Meals**: Restaurants, cafes, food delivery
- **Travel**: Flights, hotels, Airbnb, Uber, etc.

### Monitoring
- Check **Wise Sync** dashboard daily
- Look for any events with "Error" status
- Verify balances match your Wise app

---

## Next Steps After Testing

Once you confirm webhooks are working:

1. ✅ **Leave ngrok running** for ongoing sync
2. ✅ **Monitor for a few days** to ensure reliability
3. ✅ **Consider production hosting** when ready (Heroku, DigitalOcean)
4. ✅ **Fine-tune categorization rules** as you see patterns

---

## Need Help?

### Check These First
1. **Wise Sync Dashboard**: Shows error messages
2. **Backend Terminal**: Shows processing logs
3. **ngrok Dashboard**: http://127.0.0.1:4040 shows all webhook calls
4. **Database Events**: Check `wise_webhook_events` table

### Common Questions

**Q: Does ngrok URL change when I restart?**
A: Yes! Free tier gives you a new URL each time. You'll need to update it in Wise.

**Q: Can I use the same ngrok URL forever?**
A: Free tier URLs expire when ngrok stops. Paid tier gives you permanent URLs.

**Q: What if I close my laptop?**
A: Everything stops. Restart all three terminals when you're back.

**Q: Is my data secure?**
A: Yes! ngrok uses HTTPS and Wise verifies webhook signatures.

---

**You're all set! 🎉**

Follow these steps and you'll have real-time Wise transaction syncing working in about 15 minutes.
