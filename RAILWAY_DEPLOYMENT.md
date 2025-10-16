# Railway Deployment Guide
## Business Accounting System

Complete guide for deploying the accounting system on Railway with PostgreSQL database.

---

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with the accounting system code
- Netlify account (for frontend hosting)

---

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Netlify       │         │    Railway      │
│   (Frontend)    │────────▶│   (Backend)     │
│   React + Vite  │  HTTPS  │   Express API   │
└─────────────────┘         └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │   PostgreSQL    │
                            │   (Database)    │
                            └─────────────────┘
```

---

## Part 1: Deploy Backend to Railway

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose: `business-accounting-system` repository
5. Select branch: **`live`**
6. Railway will automatically detect and deploy the backend

### Step 2: Configure Backend Service Settings

After deployment starts, go to **Settings**:

#### Root Directory
```
backend
```

#### Build Configuration
- **Builder**: Nixpacks (should auto-detect)
- **Build Command**: Leave empty (Nixpacks auto-detects)

#### Deploy Configuration
- **Start Command**: `npm start`
- **Healthcheck Path**: `/health`
- **Healthcheck Timeout**: `100`
- **Port**: `8080` (set via environment variable)

#### Restart Policy
- **Policy**: On Failure
- **Max Retries**: `10`

---

## Part 2: Add PostgreSQL Database

### Step 1: Create Database Service

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway automatically provisions the database
4. Wait for status: **Active** ✅

### Step 2: Verify Database Variables

Go to **Postgres** → **Variables** tab

Railway auto-generates these variables:
- `DATABASE_URL` - Complete connection string
- `PGHOST` - Database host
- `PGPORT` - Port (usually 5432)
- `PGUSER` - Username
- `PGPASSWORD` - Password
- `PGDATABASE` - Database name

**Do NOT modify these variables!**

---

## Part 3: Configure Backend Environment Variables

Go to **business-accounting-system** service → **Variables** tab

### Required Variables

Add these 4 variables:

#### 1. NODE_ENV
```
production
```

#### 2. PORT
```
8080
```

#### 3. DATABASE_URL
```
${{Postgres.DATABASE_URL}}
```
**Important**: Use the reference syntax `${{Postgres.DATABASE_URL}}` - Railway will inject the actual connection string

#### 4. CORS_ORIGINS
```
https://your-netlify-site.netlify.app
```
Replace with your actual Netlify URL

### Save & Wait for Redeploy

Railway automatically redeploys when variables are added. Wait for:
- ✅ Status: **Active**
- ✅ Deployment: **Successful**

---

## Part 4: Verify Backend Deployment

### Step 1: Generate Public Domain

1. Go to **business-accounting-system** → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the generated URL (e.g., `https://business-accounting-system-production.up.railway.app`)

### Step 2: Test Health Endpoint

```bash
curl https://your-railway-url.up.railway.app/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-10-16T..."}
```

### Step 3: Check Deploy Logs

Go to **Deployments** → **Deploy Logs**

Look for:
- ✅ `Server running on http://localhost:8080`
- ✅ `Database connected successfully`
- ❌ NO `ECONNREFUSED` errors

---

## Part 5: Initialize Database Schema

The database is empty and needs tables created.

### Option A: Using Local psql (Recommended)

#### Step 1: Get Database Public URL

Go to **Postgres** → **Variables** tab

Find: `DATABASE_PUBLIC_URL`

Example:
```
postgresql://postgres:abc123xyz@crossover.proxy.rlwy.net:29577/railway
```

#### Step 2: Run Schema Migration

```bash
cd /path/to/accounting
psql "YOUR_DATABASE_PUBLIC_URL" -f backend/migrations/combined_schema.sql
```

Replace `YOUR_DATABASE_PUBLIC_URL` with the actual URL from Railway.

#### Step 3: Verify Tables

```bash
psql "YOUR_DATABASE_PUBLIC_URL" -c "\dt"
```

Expected output:
```
List of relations
Schema |    Name    | Type  |  Owner
-------+------------+-------+---------
public | contracts  | table | postgres
public | employees  | table | postgres
public | entries    | table | postgres
```

### Option B: Using Railway CLI

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Step 2: Login and Link Project

```bash
railway login
railway link
```

#### Step 3: Run Migration

```bash
railway run psql $DATABASE_URL < backend/migrations/combined_schema.sql
```

### Option C: Using TablePlus / pgAdmin

1. Download TablePlus (https://tableplus.com) or pgAdmin
2. Create new connection with Railway's database credentials
3. Copy/paste contents of `backend/migrations/combined_schema.sql`
4. Execute the SQL

---

## Part 6: Deploy Frontend to Netlify

### Step 1: Connect GitHub Repository

1. Go to https://app.netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **GitHub** → Choose `business-accounting-system`
4. Select branch: **`live`**

### Step 2: Configure Build Settings

**Root Directory**: (leave empty)

**Base directory**:
```
frontend
```

**Build command**:
```
npm ci && npm run build
```

**Publish directory**:
```
frontend/dist
```

**Branch**: `live`

### Step 3: Add Environment Variables

Before deploying, add environment variable:

**Key**: `VITE_API_URL`
**Value**: `https://your-railway-backend-url.up.railway.app`

Use the Railway backend URL you generated earlier.

### Step 4: Deploy

Click **"Deploy site"**

Wait for deployment to complete. You'll get a URL like:
```
https://your-app-name.netlify.app
```

---

## Part 7: Update CORS Configuration

After getting your Netlify URL, update the backend CORS configuration:

1. Go to Railway → **business-accounting-system** → **Variables**
2. Edit `CORS_ORIGINS` variable
3. Update with your Netlify URL:
   ```
   https://your-app-name.netlify.app
   ```
4. Save (Railway will redeploy automatically)

---

## Part 8: Test Full Stack

### Test Backend API

```bash
# Health check
curl https://your-railway-url/health

# Get entries
curl https://your-railway-url/api/entries

# Get dashboard stats
curl https://your-railway-url/api/dashboard/overview
```

### Test Frontend

1. Open your Netlify URL in browser
2. You should see the accounting dashboard
3. Try creating a new entry
4. Verify data is saved (refresh page)

---

## Troubleshooting

### Issue: Database connection error (ECONNREFUSED)

**Symptoms:**
```
Database connection error: Error: connect ECONNREFUSED ::1:5432
```

**Solution:**
1. Verify `DATABASE_URL` variable in backend service uses reference syntax:
   ```
   ${{Postgres.DATABASE_URL}}
   ```
2. Check Postgres service is **Active**
3. Redeploy backend service

---

### Issue: CORS errors in browser

**Symptoms:**
```
Access to fetch at 'https://backend.railway.app' from origin 'https://frontend.netlify.app'
has been blocked by CORS policy
```

**Solution:**
1. Update `CORS_ORIGINS` in Railway backend variables
2. Include your exact Netlify URL (no trailing slash)
3. Wait for backend to redeploy
4. Clear browser cache and retry

---

### Issue: Frontend can't connect to backend

**Symptoms:**
- Network errors in browser console
- API requests failing

**Solution:**
1. Verify `VITE_API_URL` in Netlify environment variables
2. Ensure it matches Railway backend URL exactly
3. Redeploy Netlify site after changing variables
4. Test backend health endpoint directly with curl

---

### Issue: Database tables not found

**Symptoms:**
```
relation "entries" does not exist
```

**Solution:**
1. Database schema not initialized
2. Run migration: `psql "DATABASE_PUBLIC_URL" -f backend/migrations/combined_schema.sql`
3. Verify tables: `psql "DATABASE_PUBLIC_URL" -c "\dt"`

---

### Issue: Railway build fails

**Symptoms:**
```
Error creating build plan with Railpack
```

**Solution:**
1. Verify **Root Directory** is set to `backend`
2. Ensure **Builder** is set to **Nixpacks** (not Railpack)
3. Check `package.json` exists in `backend/` directory
4. Remove `Procfile` if it exists (conflicts with Nixpacks)

---

## Database Schema Overview

The combined schema creates these tables:

### entries
- Income and expense transactions
- Linked to employees and contracts
- Status tracking (pending/completed)

### employees
- Employee records with pay information
- Pay types: monthly, weekly, hourly
- Soft delete with termination dates

### contracts
- Recurring client contracts
- Automatic income generation
- Payment scheduling

---

## Monitoring & Maintenance

### View Logs

**Railway:**
- Go to service → **Deployments** → Click deployment → **Deploy Logs**

**Netlify:**
- Go to site → **Deploys** → Click deployment → **Deploy log**

### Check Database Status

```bash
# Connect to database
psql "YOUR_DATABASE_PUBLIC_URL"

# Check table row counts
SELECT
  'entries' as table_name, COUNT(*) as count FROM entries
UNION ALL
SELECT 'employees', COUNT(*) FROM employees
UNION ALL
SELECT 'contracts', COUNT(*) FROM contracts;
```

### Monitor Resource Usage

**Railway Dashboard:**
- CPU and Memory usage per service
- Database storage usage
- Network traffic

---

## Cost Considerations

### Railway Free Tier
- $5 usage credit per month
- Good for development and testing
- Backend + PostgreSQL fit within free tier

### Netlify Free Tier
- 100 GB bandwidth/month
- Automatic HTTPS
- Unlimited personal projects

---

## Next Steps

1. ✅ Set up custom domain (optional)
2. ✅ Configure automatic backups
3. ✅ Set up monitoring/alerts
4. ✅ Add authentication (if needed)
5. ✅ Configure CI/CD pipelines

---

## Support & Resources

- **Railway Docs**: https://docs.railway.app
- **Netlify Docs**: https://docs.netlify.com
- **Project Repository**: https://github.com/RafaelEpicMegacorp/business-accounting-system

---

*Last Updated: 2025-10-16*
