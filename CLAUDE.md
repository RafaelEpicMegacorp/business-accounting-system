# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Complete business accounting system with income/expense tracking, employee management, contract automation, salary calendar view, multi-currency support, and Wise banking integration.

**GitHub Repository**: https://github.com/RafaelEpicMegacorp/business-accounting-system

## 📋 Session Continuity

> **👋 RESTARTING COMPUTER OR NEW SESSION?**
>
> **READ THIS FIRST**: `/Users/rafael/Windsurf/accounting/SESSION_STATUS.md`
>
> This file contains current session status, what was just completed, what needs testing, and exact steps to resume work.

## ⚡ Development Workflow

**CRITICAL**: This project uses specialized development agents:
- **Use `feature-supervisor` agent** for ALL implementation tasks (features, bugs, documentation)
- **Use `quality-assurance-tester` agent** when features are marked "Done"
- **Never work directly** - always delegate to appropriate agent

**Example**: User requests "Fix the Wise sync button" → Launch feature-supervisor agent with clear task description

## 🚀 Quick Command Reference

### Development (Most Common)
```bash
# Start local development (recommended)
./start-local-dev.sh              # Starts both frontend (7392) and backend (7393)

# Manual start (troubleshooting only)
cd backend && npm run dev         # Backend on port 7393
cd frontend && npm run dev        # Frontend on port 7392

# Database operations
psql -U accounting_user -d accounting_db    # Connect to local database
cd backend && npm run migrate:up            # Run next migration
cd backend && npm run migrate:down          # Rollback last migration
cd backend && npm run migrate:create NAME   # Create new migration
```

### Testing & Debugging
```bash
# Health checks
curl http://localhost:7393/health
curl http://localhost:7393/api/wise/test-connection

# Check what's using a port
lsof -i :7393
lsof -ti:7393 | xargs kill -9     # Kill process on port

# Production logs (Railway)
railway logs --service business-accounting-system
railway logs --service business-accounting-system --lines 100

# Database queries
psql -U accounting_user -d accounting_db -c "SELECT COUNT(*) FROM entries;"
psql -U accounting_user -d accounting_db -c "SELECT * FROM entries ORDER BY entry_date DESC LIMIT 5;"
```

### Deployment
```bash
# Production deployment (Railway)
git push origin live              # Auto-deploys to Railway + Netlify

# Railway CLI commands
railway link                      # Link to Railway project
railway variables                 # View environment variables
railway variables --set "KEY=value"  # Set variable
railway run bash                  # Open production shell
railway run psql $DATABASE_URL    # Access production database
```

### Cleanup & Maintenance
```bash
# Clean up weekly salary entries
cd backend && node scripts/cleanup-weekly-entries.js

# Recalculate currency balances
curl -X POST http://localhost:7393/api/currency/recalculate

# Import Wise transactions (manual CSV)
cd backend && node scripts/import-wise-transactions.js <path-to-csv>

# Production database cleanup
cd backend && DATABASE_URL="postgresql://..." node scripts/cleanup-production.js

# Manual Wise sync (immediate transaction sync)
curl -X POST http://localhost:7393/api/wise/sync/manual \
  -H "Authorization: Bearer <jwt-token>"

# Check Wise sync health
curl http://localhost:7393/api/wise/sync/health

# View Wise sync statistics
curl http://localhost:7393/api/wise/sync/stats \
  -H "Authorization: Bearer <jwt-token>"
```

## Tech Stack
- **Frontend**: React 18, Vite 5, Tailwind CSS 3.3, Lucide React icons, Axios, Recharts 3.2
- **Backend**: Node.js, Express 4, PostgreSQL 14+, pg client, JWT, bcrypt, multer
- **Database**: PostgreSQL 14+ (Railway managed)
- **Authentication**: JWT with refresh tokens
- **Currency API**: exchangerate-api.com

## Project Structure
```
/Users/rafael/Windsurf/accounting/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/         # 17 React components
│   │   │   ├── AccountingApp.jsx      # Main app wrapper with routing
│   │   │   ├── App.jsx                # Root component with auth context
│   │   │   ├── Login.jsx              # Authentication interface
│   │   │   ├── DashboardView.jsx      # Dashboard with stats and charts
│   │   │   ├── SalaryCalendar.jsx     # Calendar view for salary payments
│   │   │   ├── EmployeeList.jsx       # Employee management
│   │   │   ├── ContractList.jsx       # Contract management
│   │   │   └── WiseImport.jsx         # Wise CSV import modal
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx        # Authentication context provider
│   │   ├── services/           # 6 API service modules
│   │   │   ├── api.js                 # Axios instance with JWT interceptors
│   │   │   ├── entryService.js        # Entry CRUD operations
│   │   │   ├── employeeService.js     # Employee operations
│   │   │   ├── contractService.js     # Contract operations
│   │   │   ├── dashboardService.js    # Dashboard statistics
│   │   │   └── currencyService.js     # Currency/balance operations
│   │   └── utils/
│   │       └── csvExport.js           # CSV export utilities
│   └── .env.example
├── backend/           # Express API server
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js            # PostgreSQL pool with connection limits
│   │   ├── models/                    # 6 database models
│   │   │   ├── entryModel.js          # Income/expense operations
│   │   │   ├── employeeModel.js       # Employee management
│   │   │   ├── contractModel.js       # Contract operations
│   │   │   ├── dashboardModel.js      # Dashboard statistics
│   │   │   ├── wiseTransactionModel.js # Wise transaction tracking
│   │   │   └── currencyModel.js       # Multi-currency balances
│   │   ├── controllers/               # 5 controllers
│   │   ├── routes/                    # 7 route modules
│   │   ├── middleware/
│   │   │   └── auth.js                # JWT verification middleware
│   │   ├── services/
│   │   │   └── wiseClassifier.js      # Transaction classification logic
│   │   └── server.js                  # Express server
│   ├── scripts/
│   │   ├── cleanup-weekly-entries.js  # Clean duplicate salary entries
│   │   ├── cleanup-production.js      # Production cleanup
│   │   └── import-wise-transactions.js # Wise CSV import utility
│   ├── migrations/                    # 13 database migrations
│   └── .env.example
├── DOCS/              # 📁 Complete API Documentation
│   ├── README.md                      # Documentation index
│   ├── API/
│   │   ├── INTERNAL_API.md           # All 51 backend endpoints
│   │   ├── WISE_API_REFERENCE.md     # Wise API integration guide
│   │   └── API_QUICK_REFERENCE.md    # Fast lookup tables
│   └── ARCHITECTURE/                  # Architecture documentation
└── README.md          # Complete documentation
```

## API Documentation

**📁 Complete API documentation**: See [DOCS/](./DOCS/) folder

### Quick Links
- **[Documentation Index](./DOCS/README.md)** - Start here for all documentation
- **[Internal API Reference](./DOCS/API/INTERNAL_API.md)** - All 51 backend endpoints with examples
- **[Wise API Reference](./DOCS/API/WISE_API_REFERENCE.md)** - Wise integration endpoints
- **[API Quick Reference](./DOCS/API/API_QUICK_REFERENCE.md)** - Fast lookup table

### Authentication
- **Internal API**: JWT Bearer token from `POST /api/auth/login`
- **Wise API**: API token from Wise dashboard
- **Default User**: Username: `rafael`, Password: `asdflkj@3!`

### Most Used Endpoints
- **Login**: `POST /api/auth/login` - Get JWT token
- **Get Entries**: `GET /api/entries` - List all entries with filtering
- **Create Entry**: `POST /api/entries` - Add income/expense
- **Import Wise CSV**: `POST /api/wise/import` - Upload Wise CSV file
- **Manual Wise Sync**: `POST /api/wise/sync/manual` - Trigger immediate sync
- **Wise Sync Health**: `GET /api/wise/sync/health` - Check sync status
- **Wise Webhook**: `POST /api/wise/webhook` - Receive Wise events (public)
- **Get Dashboard**: `GET /api/dashboard/stats` - Dashboard statistics
- **Get Balances**: `GET /api/currency/balances` - Multi-currency balances

Full endpoint documentation with request/response examples in [DOCS/API/INTERNAL_API.md](./DOCS/API/INTERNAL_API.md)

## Database Schema

### Core Tables Summary

**users** - Authentication (id, username, password, name)
**entries** - All financial transactions with multi-currency support
**employees** - Employee profiles with pay rates and multipliers
**contracts** - Recurring income contracts with auto-generation
**currency_balances** - Multi-currency balance tracking
**currency_exchanges** - Exchange rate history
**wise_transactions** - Wise transaction storage and classification

Full schema with CREATE TABLE statements in migration files: `backend/migrations/`

### Key Relationships
- `entries.employee_id` → `employees.id` (FK, nullable)
- `entries.contract_id` → `contracts.id` (FK, nullable, CASCADE on delete)
- `wise_transactions.matched_employee_id` → `employees.id` (FK, nullable)
- `wise_transactions.entry_id` → `entries.id` (FK, nullable)

### Database Migrations (13 total)
Run migrations in order from 001 to 013. See `backend/migrations/` directory.

## Key Architecture Patterns

### Authentication Flow
1. User logs in with username/password → Backend generates JWT
2. Frontend stores JWT in AuthContext (memory only, no localStorage)
3. Axios interceptor adds `Authorization: Bearer <token>` to all requests
4. Protected routes check token via ProtectedRoute wrapper component
5. Token refresh happens automatically on 401 responses

### Database Connection Management
```javascript
// CRITICAL: All database queries must use pool.query() or pool.getClient()
// Always release clients in finally block:
const client = await pool.getClient();
try {
  await client.query('BEGIN');
  // ... operations
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();  // MUST release or pool will exhaust
}
```

**Pool Configuration** (backend/src/config/database.js):
- **Max connections**: 5 (Railway free tier optimized)
- **Idle timeout**: 30 seconds
- **Connection timeout**: 10 seconds
- Without limits, CSV imports fail with "Database connection failed"

### Entry Classification Logic
- **Salary entries**: `employee_id` IS NOT NULL, category='salary'
- **Contract entries**: `contract_id` IS NOT NULL, auto-generated
- **Manual entries**: Both IDs NULL, user-created
- **Wise imports**: `wise_transaction_id` NOT NULL, classified by wiseClassifier

### Weekly Salary Calculation (CRITICAL)
```javascript
// IMPORTANT: pay_rate is ALWAYS monthly salary, not weekly
const weeklyAmount = (employee.pay_rate / 4) * employee.pay_multiplier;
const paymentDate = getNextFriday(); // Weekly payments on Friday
```
- Weekly employees: Divide monthly rate by 4
- Monthly employees: Use pay_rate directly, pay on last day of month
- Auto-cleanup removes incorrect Sunday entries before generating Friday entries

### API Response Patterns
All endpoints return consistent format:
```javascript
// Success
{ success: true, data: {...}, message: "Optional message" }

// Error
{ success: false, error: "Error type", message: "User-friendly message" }
```

### Wise Transaction Classification
**Employee Matching Algorithm** (wiseClassifier.js):
- **Name matching**: 100% if exact match, 70% if partial
- **Amount matching**: +10% if matches employee pay
- **Frequency matching**: +10% if matches pay schedule
- **Confidence threshold**: 40% minimum for auto-assignment
- **Review flagging**: <60% confidence requires manual review

## Configuration Standards (CRITICAL)

⚠️ **NEVER HARDCODE ANYTHING** - This is a mandatory project standard

**NEVER Hardcode:**
- ❌ API endpoints or URLs
- ❌ API tokens, keys, or secrets
- ❌ Ports or connection strings
- ❌ Database credentials
- ❌ OAuth client IDs/secrets
- ❌ Webhook secrets

**ALWAYS Use:**
- ✅ Environment variables (`process.env.VARIABLE_NAME`)
- ✅ `.env` files for local development (gitignored)
- ✅ Railway/platform variables for production
- ✅ Validation at application startup
- ✅ Clear error messages when variables are missing

### Good vs Bad Examples

```javascript
// ❌ WRONG - Hardcoded with fallback
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ✅ CORRECT - Required environment variable
const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set');
}
```

### Required Environment Variables

**Backend `.env`:**
```bash
PORT=7393
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@host:port/database
JWT_SECRET=your_secret_key
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=your_token_here
WISE_PROFILE_ID=your_profile_id
CORS_ORIGINS=http://localhost:5173,http://localhost:7392
```

**Frontend `.env`:**
```bash
VITE_API_URL=http://localhost:7393
VITE_PORT=5173
```

### Startup Validation
```javascript
const requiredEnvVars = ['PORT', 'DATABASE_URL', 'JWT_SECRET', 'WISE_API_URL', 'WISE_API_TOKEN'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`ERROR: ${varName} environment variable is not set`);
    process.exit(1);
  }
});
```

### Scan for Hardcoded Values
```bash
# Scan for potential hardcoded URLs
grep -r "https://" src/ --exclude-dir=node_modules

# Scan for hardcoded ports
grep -r "localhost:[0-9]" src/ --exclude-dir=node_modules

# Scan for hardcoded tokens (UUID pattern)
grep -r "[0-9a-f]\{8\}-[0-9a-f]\{4\}" src/ --exclude-dir=node_modules
```

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Local Setup
```bash
# 1. Create database
psql -U postgres
CREATE DATABASE accounting_db;
CREATE USER accounting_user WITH PASSWORD 'accounting_pass';
GRANT ALL PRIVILEGES ON DATABASE accounting_db TO accounting_user;

# 2. Run migrations in order (001 through 013)
psql -U accounting_user -d accounting_db -f backend/migrations/001_initial_schema.sql
# ... continue through all migrations

# 3. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with correct values

# 4. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 5. Start development servers
./start-local-dev.sh  # Recommended: starts both services
```

## Common Issues & Solutions

### Database Connection Errors
- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env` match database user
- Ensure database exists: `psql -U postgres -l`
- **Pool exhaustion**: Check pool configuration in database.js

### CORS Errors
- Add frontend URL to `CORS_ORIGINS` in backend `.env`
- Restart backend server after .env changes
- Check frontend is using correct `VITE_API_URL`

### Port Conflicts
- Check what's using port: `lsof -i :7393`
- Kill process: `lsof -ti:7393 | xargs kill -9`
- Change PORT in `.env` if needed

### Authentication Issues
- **401 Unauthorized**: Check JWT token is being sent in headers
- **Token expired**: Use refresh endpoint or login again
- **CORS on auth**: Ensure credentials are included in requests
- **Default login**: Username: `rafael`, Password: `asdflkj@3!`

### Wise CSV Import Errors
**Symptoms**: 500 error, "Database connection failed"
**Solutions**:
1. Check pool configuration is set (max: 5, timeouts configured)
2. Test connection: `GET /api/wise/test-connection`
3. Verify CSV format is 21-column Wise export
4. Check Railway database connection limit not exceeded

**Manual Cleanup** (if needed):
```bash
cd backend && node scripts/cleanup-weekly-entries.js
```

### Weekly Salaries Not Appearing
**Symptoms**: Weekly employees missing from calendar or showing wrong amounts/days
**Solution**:
1. Navigate to Salaries tab - this triggers auto-generation
2. Auto-cleanup removes any Sunday entries for weekly employees
3. New correct entries are generated on Fridays with proper calculation
4. If issues persist, check employee `pay_rate` is set to MONTHLY salary (not weekly)

### Multi-Currency Balance Issues
- Balances not updating: Call `POST /api/currency/recalculate`
- Exchange rates outdated: Check `currency_exchanges` table
- USD conversion wrong: Verify exchange rates from API
- Missing currency: Add to `currency_balances` table manually

### Railway Deployment Issues

**Environment Variables Not Loading**
```bash
# Check current variables
railway variables

# Set required variables
railway variables --set "WISE_API_TOKEN=xxx"
railway variables --set "JWT_SECRET=xxx"

# Force redeploy
git commit --allow-empty -m "Force redeploy"
git push origin live
```

**Database Connection Failures**
- Check DATABASE_URL is set: `railway variables | grep DATABASE`
- Test connection: `railway run psql $DATABASE_URL`
- Verify pool config in `backend/src/config/database.js`
- Check Railway logs: `railway logs --lines 100`

**Build Failures**
- Check logs: `railway logs --service business-accounting-system`
- Verify package.json scripts match Railway settings
- Ensure migrations ran: Check Railway database directly
- Confirm all required env vars are set in Railway dashboard

## Wise API Setup & Configuration

### 🔑 Production Credentials

**⚠️ IMPORTANT - Token is in `.env` and Railway (never committed to git)**

```bash
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=10b1f19c-bd61-4c9b-8d86-1ec264550ad4
WISE_PROFILE_ID=74801125  # Business Profile: Deploy Staff Sp. z o.o.
```

**Verified Profiles**:
- **Personal Profile** (ID: `74801255`): Celso Rafael Vieira
- **Business Profile** (ID: `74801125`): Deploy Staff Sp. z o.o. ⭐ **USE THIS ONE**

**Token Details**:
- **Type**: Personal API Token
- **Permissions**: Read access to profiles, balances, activities, transfers
- **Status**: Active and verified (tested October 28, 2025)
- **Security**: Token documented here for reference (private repo), never commit to git
- 🔄 Token should be rotated every 90 days
- 🔒 Token has read-only permissions (cannot make transfers)

### API Endpoints by Version

**Important**: Wise uses different API versions for different endpoints:

- **Profiles (List)**: `/v1/profiles` - Get user profile information ⚠️ Use v1, not v2
- **Balances (List)**: `/v4/profiles/{profileId}/balances?types=STANDARD` - Get currency balances
- **Balance Statement**: `/v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json` - Transaction history
- **Webhooks**: `/v3/profiles/{profileId}/subscriptions` - Event notifications

### Testing Wise Connection

```bash
# Method 1: Postman
# GET https://api.wise.com/v1/profiles
# Authorization: Bearer <WISE_API_TOKEN>

# Method 2: Test endpoints
curl http://localhost:7393/api/wise/test-connection
curl https://business-accounting-system-production.up.railway.app/api/wise-test/test-all

# Method 3: Command-line scripts
cd backend
node scripts/test-wise-profile.js
```

### Common Wise API Issues

**Issue 1: "Unexpected token < in JSON"**
- **Cause**: `WISE_API_URL` pointing to wrong URL (backend instead of Wise API)
- **Solution**: Ensure `WISE_API_URL=https://api.wise.com`

**Issue 2: 401 Unauthorized**
- **Cause**: Invalid or expired API token
- **Solution**: Generate new token at wise.com → Settings → API tokens

**Issue 3: Wrong API Version (404)**
- **Cause**: Using `/v2/profiles` instead of `/v1/profiles`
- **Solution**: Profiles use v1, Balances use v4. Check DOCS/API/WISE_API_REFERENCE.md

Full Wise API setup guide: See [Wise API Setup section in full CLAUDE.md](#wise-api-setup--configuration)

## Production Deployment

### Live Environment
- **Frontend**: https://ds-accounting.netlify.app (Netlify auto-deploy from `live` branch)
- **Backend**: https://business-accounting-system-production.up.railway.app (Railway auto-deploy from `live` branch)
- **Database**: Railway PostgreSQL (managed)
- **Branch**: `live` (auto-deploy to production)

### Deployment Process
1. Push to `live` branch on GitHub: `git push origin live`
2. Netlify auto-builds and deploys frontend
3. Railway auto-builds and deploys backend
4. Database migrations must be run manually if schema changes

### Environment Variables

**Netlify (Frontend)**:
```bash
VITE_API_URL=https://business-accounting-system-production.up.railway.app
```

**Railway (Backend)**:
```bash
# Automatically set by Railway
DATABASE_URL=postgresql://...
PORT=3001

# Must set manually
NODE_ENV=production
JWT_SECRET=<your-secret>
CORS_ORIGINS=https://ds-accounting.netlify.app
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=<your-token>
WISE_PROFILE_ID=74801125
```

## Development Practices

### Code Standards
- Keep changes simple and minimal
- Avoid complex or massive refactors
- Impact as little code as possible per change
- Use consistent naming conventions
- Follow React hooks best practices
- Validate all environment variables at application startup
- **NEVER hardcode** API endpoints, tokens, ports, or credentials

### Bug Tracking
- Create `.md` files in `BUGS/` folder
- Document user reports with exact descriptions
- Track all fix attempts with results
- Require user confirmation before marking solved
- Move solved bugs to `BUGS/SOLVED/`

### Task Management
- Create `.md` files in `TASKS/` folder
- Break complex tasks into smaller steps
- Update progress in real-time
- Add review section on completion
- Move completed tasks to `TASKS/SOLVED/`

### Git Workflow
- Commit before starting new features
- Use descriptive commit messages
- Document changes at high level
- Keep commits focused and atomic

## Key Features Implemented

### ✅ Authentication System
- JWT-based authentication with refresh tokens
- Login/Logout with secure session management
- Protected routes requiring authentication
- User context propagated throughout app

### ✅ Income & Expense Tracking
- Record income/expense entries with categories
- Date tracking and status management (completed/pending)
- Filter by type, category, date range
- Bulk operations (delete, status updates)
- Entry-level currency tracking

### ✅ Multi-Currency Support
- Balance tracking in USD, EUR, PLN, GBP
- Automatic USD conversion using real-time exchange rates
- Currency exchange tracking with rate history
- Balance display on dashboard with individual currency cards
- Recalculation endpoint for balance updates

### ✅ Wise Banking Integration

**Three Integration Methods** (All Operational):

1. **CSV Import** - Manual upload of Wise transaction exports
   - 21-column format validation
   - Duplicate prevention by Wise transaction ID
   - Import statistics (imported/skipped/errors)
   - Drag-and-drop interface

2. **Automated Daily Sync** - Background cron job (every 6 hours)
   - Fetches Activities API for new transactions
   - Automatic duplicate detection
   - Runs at: 00:00, 06:00, 12:00, 18:00 UTC
   - Syncs transactions from last 30 days
   - Catches any missed webhooks

3. **Real-time Webhooks** - Push notifications from Wise
   - Instant transfer state change updates
   - Event types: balances#credit, transfers#state-change, transfers#active-cases
   - Webhook endpoint: `POST /api/wise/webhook`
   - Verified operational (17+ events captured)

**Shared Features**:
- Automatic classification using wiseClassifier.js
- Employee matching (40-100% confidence scoring)
- Entry creation for high-confidence transactions
- Review flagging for low-confidence transactions
- Currency preservation (no forced USD conversion)

### ✅ Salary Calendar View
- Monthly calendar grid showing all salary payments by date
- Weekly summaries with automatic total calculations
- Daily breakdown - click any day to see detailed payment info
- Color-coded by status (green=completed, yellow=pending)
- Auto-generates missing salary entries when Salaries tab loads

### ✅ Employee Management
- Add/edit/delete employees with position field
- Track pay type (monthly/weekly/hourly)
- Calculate pay with multipliers
- Soft delete with termination dates
- Bulk operations (delete, terminate, reactivate)
- Severance calculator with automatic pay calculation
- Payment history with complete tracking and statistics

### ✅ Contract Management
- Recurring contract setup (monthly/yearly/one-time)
- Automated income entry generation
- Contract status tracking
- Auto-generation on contract dates
- Contract badges in UI

### ✅ Bulk Operations
- Multi-select with checkboxes
- Bulk delete entries/employees
- Bulk status updates (completed/pending)
- Bulk terminate/reactivate employees
- All entries are selectable including contract-generated ones
- Warning dialog for contract entry deletions

### ✅ Dashboard & Analytics
- Financial widgets - Income, expenses, balance overview
- Wise balance cards - Multi-currency balances with USD conversion
- Charts - Income vs Expense (line chart), Category Breakdown (pie chart)
- Employee statistics - Active vs terminated counts
- Recent entries - Latest transactions

### ✅ Cash Flow Forecasting
- End-of-month forecast - Predictive balance calculation
- Weekly breakdown - Expense projections by week
- Monthly summary - Total expected expenses
- Runway calculation - Days until balance depleted

### ✅ CSV Export
- Export entries to CSV with all fields
- Export employees to CSV with statistics
- Export contracts to CSV with details
- Download functionality - Direct browser download

### ✅ Search and Advanced Filtering
- Global search across description, employee name, category
- Debounced search (300ms delay)
- Date range filter, amount range filter
- Category filter with multi-select
- Employee filter dropdown
- Status filter (completed/pending/all)
- Currency filter (USD/EUR/PLN/GBP/all)
- Combined filters work together simultaneously
- Collapsible filter panel to save screen space

## Recent Changes (October 2025)

### Complete Wise Integration (October 30, 2025) ✅
**Status**: Production-ready and verified operational

**Three Integration Methods**:
1. **CSV Import** - Manual upload workflow
2. **Automated Sync** - Cron job every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
3. **Real-time Webhooks** - Push notifications from Wise (17+ events captured)

**New Endpoints**:
- `POST /api/wise/sync/manual` - Trigger immediate sync
- `GET /api/wise/sync/health` - Check sync health and last run time
- `GET /api/wise/sync/stats` - View detailed sync statistics
- `POST /api/wise/webhook` - Webhook receiver (public endpoint)

**Database Tables**:
- `wise_sync_metadata` - Track last sync times and statistics
- `wise_sync_audit_log` - Log all webhook events and sync operations
- `wise_transactions` - Store all Wise transactions with classification

**Cron Job Configuration**:
- Schedule: Every 6 hours (0 */6 * * *)
- Environment variable: `WISE_SYNC_ENABLED=true`
- Custom schedule: `WISE_SYNC_CRON` (optional override)
- Syncs last 30 days of transactions
- Automatic duplicate prevention

**Webhook Configuration** (Wise Dashboard):
- URL: `https://business-accounting-system-production.up.railway.app/api/wise/webhook`
- Events: balances#credit, balances#update, transfers#state-change, transfers#active-cases
- Verification: 17+ webhook events captured and logged
- No signature validation required for personal accounts

**Verification Report**: See `/Users/rafael/Windsurf/accounting/WEBHOOK_VERIFICATION_REPORT.md`

### Configuration Standards Documentation
- Added comprehensive "Configuration Standards" section
- Mandatory project-wide rule - NEVER hardcode anything
- Includes bad/good examples, validation patterns, pre-deployment checklist
- Commands to scan for hardcoded values

### Wise API Configuration
- Updated Wise API URL from transferwise.com to wise.com
- Token updated with working token (10b1f19c...)
- Endpoints changed profiles from /v2 to /v1 (verified working)
- Complete setup guide added

### Wise CSV Import
- WiseImport.jsx professional upload modal
- wiseImport.js route with 21-column format validation
- Features: Duplicate detection, import statistics, error handling
- "Import CSV" button added to dashboard

### Multi-Currency Support
- Tables: currency_balances, currency_exchanges
- Currencies: USD, EUR, PLN, GBP
- Features: Automatic USD conversion, exchange rate tracking
- 7 new currency endpoints
- Currency balance cards on dashboard

### Database Pool Configuration Fix
- Problem: CSV imports failing with "Database connection failed"
- Solution: Added max connections (5), idle timeout (30s), connection timeout (10s)
- Diagnostic: Added GET /api/wise/test-connection endpoint

Full change history available in git commits and README.md

## Environment
- **Active Branch**: `live` - auto-deploys to production (Netlify + Railway)
- **Main Branch**: `main` - merge from `live` when ready
- **Development**: All changes should be done in `live` branch
- **Testing**: Test locally first, then push to `live` for production deployment
- **Database**: Live production database on Railway (be careful with migrations)

---

*Last Updated: 2025-10-29*
*Always use feature-supervisor for implementation tasks*
*Always use quality-assurance-tester when features are ready for testing*
