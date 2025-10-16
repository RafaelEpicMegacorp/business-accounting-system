# Wise Webhook Integration - Deployment Guide

## Overview
This guide covers deploying and registering the Wise webhook integration for real-time transaction sync.

## What Was Built

### Backend Components
1. **Database Schema** (`migrations/012_wise_webhook_support.sql`)
   - `wise_webhook_events` - Stores raw webhook payloads
   - `wise_sync_status` - Tracks sync status and statistics
   - `wise_transactions` - Deduplication using Wise transaction IDs
   - `entries.wise_transaction_id` - Links accounting entries to Wise transactions

2. **Webhook Controller** (`src/controllers/wiseWebhookController.js`)
   - Signature verification for security
   - Event processing and storage
   - Smart auto-categorization
   - Balance tracking
   - Error handling and retry logic

3. **API Endpoints** (`src/routes/wise.js`)
   - `POST /api/wise/webhook` - Receives webhooks from Wise
   - `GET /api/wise/status` - View sync status
   - `GET /api/wise/events` - View webhook events
   - `POST /api/wise/process-pending` - Manually process pending events
   - `POST /api/wise/config` - Update webhook configuration
   - `GET /api/wise/balances` - Fetch current balances from Wise

### Frontend Components
4. **Wise Sync Dashboard** (`frontend/src/components/WiseSync.jsx`)
   - Real-time sync status display
   - Webhook event history
   - Balance tracking
   - Manual processing controls
   - Error monitoring

## Deployment Steps

### Option 1: Using ngrok (Testing/Development)

ngrok creates a secure tunnel to your local server, perfect for testing webhooks.

#### 1. Install ngrok
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

#### 2. Start Your Backend Server
```bash
cd /Users/rafael/Windsurf/accounting/backend
npm run dev
# Server should be running on port 3001
```

#### 3. Start ngrok Tunnel
```bash
ngrok http 3001
```

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

#### 4. Register Webhook with Wise

1. Go to Wise Settings → Integrations → Webhooks
2. Click "Create Subscription" or "Add Webhook"
3. Configure:
   - **Webhook URL**: `https://abc123.ngrok.io/api/wise/webhook`
   - **Events to Subscribe**:
     - `balances#credit` - Incoming transfers
     - `balances#debit` - Outgoing payments
     - `transfers#state-change` - Transfer status updates
   - **Profile ID**: `74801255` (your profile ID)

4. Save the webhook subscription

5. **Important**: Copy the webhook secret that Wise provides

#### 5. Update Your .env
```bash
# Add the webhook secret to backend/.env
WISE_WEBHOOK_SECRET=your_webhook_secret_from_wise
```

Restart your backend server after adding the secret.

#### 6. Test the Webhook

**Option A: Make a Test Transaction**
- Send yourself money or make a small transfer
- Watch the Wise Sync dashboard for the event

**Option B: Use Wise's Test Webhook Feature**
- Some Wise accounts have a "Send Test Event" button
- Click it and check your dashboard

### Option 2: Production Deployment (Heroku)

#### 1. Prepare for Production
```bash
cd /Users/rafael/Windsurf/accounting/backend

# Ensure you have a Procfile
echo "web: node src/server.js" > Procfile

# Commit changes
git add .
git commit -m "Add Wise webhook integration"
```

#### 2. Deploy to Heroku
```bash
# Login to Heroku
heroku login

# Create app
heroku create your-accounting-app

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set WISE_API_TOKEN=3fef0a08-05a8-499a-8309-42dfd70054ae
heroku config:set WISE_API_BASE_URL=https://api.transferwise.com
heroku config:set WISE_PROFILE_ID=74801255
heroku config:set WISE_SYNC_INTERVAL=300000

# Deploy
git push heroku main

# Run migrations
heroku run "psql \$DATABASE_URL -f backend/migrations/012_wise_webhook_support.sql"

# Get your app URL
heroku apps:info
```

Your webhook URL will be: `https://your-accounting-app.herokuapp.com/api/wise/webhook`

#### 3. Register Webhook with Wise
Same as ngrok steps 4-6, but use your Heroku URL

### Option 3: Production Deployment (VPS/DigitalOcean)

#### 1. Set Up Server
```bash
# SSH into your server
ssh user@your-server.com

# Install Node.js and PostgreSQL
sudo apt update
sudo apt install nodejs npm postgresql

# Clone repository
git clone https://github.com/your-username/accounting-system.git
cd accounting-system/backend

# Install dependencies
npm install

# Set up database
sudo -u postgres psql
CREATE DATABASE accounting_db;
CREATE USER accounting_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE accounting_db TO accounting_user;
\q

# Run migrations
psql -U accounting_user -d accounting_db -f migrations/012_wise_webhook_support.sql
```

#### 2. Configure Environment
```bash
# Create .env file
nano .env

# Add:
DATABASE_URL=postgresql://accounting_user:your_secure_password@localhost:5432/accounting_db
PORT=3001
NODE_ENV=production
WISE_API_TOKEN=3fef0a08-05a8-499a-8309-42dfd70054ae
WISE_API_BASE_URL=https://api.transferwise.com
WISE_PROFILE_ID=74801255
WISE_SYNC_INTERVAL=300000
WISE_WEBHOOK_SECRET=your_webhook_secret
```

#### 3. Set Up Process Manager
```bash
# Install PM2
sudo npm install -g pm2

# Start application
pm2 start src/server.js --name accounting-api

# Set up auto-start on reboot
pm2 startup
pm2 save
```

#### 4. Configure Nginx as Reverse Proxy
```bash
# Install Nginx
sudo apt install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/accounting

# Add:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/accounting /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Set Up SSL with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Your webhook URL will be: `https://your-domain.com/api/wise/webhook`

## Verification Steps

### 1. Check Backend Health
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Check Wise Status Endpoint
```bash
curl http://localhost:3001/api/wise/status
# Should return sync status data
```

### 3. Monitor Webhook Events
- Open the accounting app: http://localhost:5173 (or your production URL)
- Click "Wise Sync" tab
- You should see:
  - Webhook status (enabled/disabled)
  - Event statistics
  - Current balances
  - Recent webhook events

### 4. Test Webhook Processing
Make a small test transaction:
1. Send $1 to yourself via Wise
2. Wait 30-60 seconds
3. Refresh the Wise Sync dashboard
4. You should see:
   - New event in "Recent Webhook Events"
   - Event marked as "Processed"
   - New entry created in Income/Expenses tab
   - Balances updated

## Troubleshooting

### Webhook Not Receiving Events
```bash
# Check if webhook is registered in Wise
# Go to Wise Settings → Integrations → Webhooks

# Verify your webhook URL is accessible publicly
curl https://your-webhook-url.com/api/wise/webhook

# Check server logs
tail -f /path/to/logs

# For ngrok, check the web interface
# Open http://127.0.0.1:4040 in browser
```

### Signature Verification Failing
```bash
# Ensure WISE_WEBHOOK_SECRET is set correctly
echo $WISE_WEBHOOK_SECRET

# Check webhook secret in Wise dashboard matches
# Restart server after updating secret
```

### Events Not Processing
```bash
# Check pending events
curl http://localhost:3001/api/wise/events?processed=false

# Manually trigger processing
curl -X POST http://localhost:3001/api/wise/process-pending

# Check for error messages
psql -U accounting_user -d accounting_db
SELECT * FROM wise_webhook_events WHERE error_message IS NOT NULL;
```

### Database Connection Issues
```bash
# Test database connection
psql -U accounting_user -d accounting_db -c "SELECT 1"

# Check migration applied
psql -U accounting_user -d accounting_db -c "\dt wise*"
# Should show: wise_webhook_events, wise_sync_status, wise_transactions
```

## Smart Auto-Categorization Rules

The system automatically categorizes transactions based on merchant names and descriptions:

### Income
- **Client Payment**: ZIDAN MANAGEMENT GROUP
- **Other Income**: Everything else

### Expenses
- **Salary**: Upwork, employee names (Asif, Maryana, Abhijeet)
- **Software**: Notion, GitHub, ChatGPT, OpenAI, AWS, Vercel, Heroku
- **Equipment**: Laptop, computer, monitor, keyboard, mouse, headphones
- **Office Rent**: Coworking, WeWork, Regus, office, workspace
- **Business Meals**: Restaurant, cafe, coffee, food, Uber Eats, DoorDash
- **Travel**: Flight, hotel, Airbnb, Uber, Lyft, taxi, rental car
- **Other Expense**: Default category

## Security Considerations

1. **Webhook Secret**: Always use a webhook secret for signature verification
2. **HTTPS Only**: Wise requires HTTPS for webhook endpoints
3. **Rate Limiting**: Consider adding rate limiting to webhook endpoint
4. **Authentication**: Add auth middleware to management endpoints in production
5. **Error Logging**: Monitor error logs for suspicious activity

## Monitoring & Maintenance

### Daily Checks
- View Wise Sync dashboard for any failed events
- Check that balances match Wise app
- Verify recent transactions were imported correctly

### Weekly Tasks
- Review auto-categorization accuracy
- Update category rules if needed
- Check for any pending events that failed to process

### Monthly Tasks
- Compare accounting entries with Wise statements
- Verify all transactions were captured
- Review and update webhook configuration if needed

## API Reference

### POST /api/wise/webhook
**Purpose**: Receive webhook events from Wise
**Authentication**: Webhook signature verification
**Request**: Wise webhook payload
**Response**: `{ received: true }`

### GET /api/wise/status
**Purpose**: Get webhook sync status and statistics
**Response**:
```json
{
  "status": {
    "webhook_enabled": true,
    "profile_id": 74801255,
    "total_events_received": 42,
    "total_events_processed": 40,
    "total_events_failed": 2,
    "current_balance_usd": 12543.21
  },
  "recentEvents": [...]
}
```

### GET /api/wise/events?limit=50&processed=true
**Purpose**: Get webhook event history
**Query Params**:
- `limit`: Max events to return (default 50)
- `processed`: Filter by processed status (true/false)

### POST /api/wise/process-pending
**Purpose**: Manually process pending webhook events
**Response**:
```json
{
  "processed": 5,
  "failed": 0,
  "results": [...]
}
```

### GET /api/wise/balances
**Purpose**: Fetch current balances from Wise API
**Response**: Array of balance objects

## Next Steps

1. **Test thoroughly** with small transactions
2. **Monitor for 1 week** to ensure reliability
3. **Add more categorization rules** as you discover patterns
4. **Set up monitoring alerts** for failed events
5. **Consider adding**:
   - Email notifications for large transactions
   - Slack integration for webhook events
   - Manual review queue for uncertain categorizations
   - Multi-currency conversion reports

## Support

For issues:
1. Check the Wise Sync dashboard for error messages
2. Review server logs
3. Check Wise API documentation: https://docs.wise.com/api-docs/
4. Test webhook signature verification independently

---

**Created**: 2025-01-15
**Last Updated**: 2025-01-15
**Status**: Ready for deployment
