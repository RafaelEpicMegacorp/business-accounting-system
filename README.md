# Business Accounting System

A comprehensive full-stack accounting application for managing business finances, employee salaries, contracts, and financial forecasting. Built with React, Node.js, and PostgreSQL.

![Status](https://img.shields.io/badge/status-production-green)
![React](https://img.shields.io/badge/react-18.2.0-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-blue)

## ✨ Key Features

### 💰 Financial Management
- ✅ **Income Tracking** - Record and monitor all business income with date tracking
- ✅ **Expense Management** - Track business expenses by category
- ✅ **Salary Management** - Visual calendar view for employee payments with weekly/monthly summaries
- ✅ **Contract Management** - Automated income generation from recurring contracts
- ✅ **Real-time Balance** - Live calculation of net balance and financial metrics
- ✅ **End-of-Month Forecast** - Predictive financial forecasting with weekly/monthly breakdowns
- ✅ **Dual Amount Tracking** - Base amount and total (with taxes/fees)
- ✅ **Status Tracking** - Mark entries as completed or pending

### 👥 Employee Management
- ✅ **Employee Profiles** - Complete employee information with pay rates and multipliers
- ✅ **Pay Types** - Support for monthly, weekly, and hourly pay structures
- ✅ **Pay Multipliers** - Flexible compensation adjustments (bonuses, deductions)
- ✅ **Termination Workflow** - Employee termination with automatic severance calculation
- ✅ **Severance Calculator** - Automatic calculation based on days worked and pay type
- ✅ **Reactivation** - Restore terminated employees
- ✅ **Payment History** - Complete tracking of all employee payments with statistics
- ✅ **Employee Statistics** - Total paid, total entries, last payment date

### 📅 Salary Calendar View
- ✅ **Monthly Calendar** - Visual calendar showing all salary payments by date
- ✅ **Weekly Summaries** - Automatic weekly total calculations in sidebar
- ✅ **Daily Breakdown** - Click any day to see detailed payment information
- ✅ **Visual Indicators** - Color-coded completed (green) and pending (yellow) payments
- ✅ **Month Navigation** - Easy browsing of past and future months with "Today" button
- ✅ **Payment Details Modal** - Full payment details with edit/delete actions
- ✅ **Month Statistics** - Total completed, pending, and payment count summaries

### 📊 Dashboard & Analytics
- ✅ **Financial Widgets** - At-a-glance view of income, expenses, and balance
- ✅ **Balance Tracking** - Current balance and forecasted end-of-month balance
- ✅ **Payment Statistics** - Total payments, pending amounts, and trends
- ✅ **Contract Overview** - Active contracts and upcoming payments
- ✅ **Employee Overview** - Active vs terminated employee counts
- ✅ **Forecast Details** - Weekly and monthly payment breakdowns

### ⚡ Bulk Operations
- ✅ **Bulk Delete** - Delete multiple entries or employees at once
- ✅ **Bulk Status Update** - Mark multiple entries as completed/pending
- ✅ **Bulk Terminate** - Terminate multiple employees simultaneously with date selection
- ✅ **Bulk Reactivate** - Reactivate multiple terminated employees
- ✅ **Smart Protection** - Checkbox-based selection with visual feedback
- ✅ **Error Handling** - Detailed reporting of successful and failed operations
- ✅ **Confirmation Dialogs** - Warning for contract-generated entries

### 🔄 Contract Automation
- ✅ **Auto-Generation** - Create income entries from contracts (monthly, yearly, one-time)
- ✅ **Manual Control** - Generate entries on-demand with button click
- ✅ **Contract Types** - Support for monthly, yearly, and one-time contracts
- ✅ **Payment Scheduling** - Automatic payment date calculation based on contract type
- ✅ **Contract Badges** - Visual identification of contract-generated entries
- ✅ **Status Management** - Active/inactive contract states
- ✅ **Past Payment Handling** - Auto-mark past dates as completed

## Quick Start

### Prerequisites
- Docker Desktop (for PostgreSQL)
- Node.js v16+
- npm

### 5-Minute Setup

1. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Start PostgreSQL**
   ```bash
   docker-compose up -d postgres
   ```

3. **Run Database Migration**
   ```bash
   docker exec -i accounting_db psql -U accounting_user -d accounting_db < backend/migrations/001_initial_schema.sql
   ```

4. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```

5. **Install & Start Frontend** (new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Open Browser**
   Visit http://localhost:5173

See **SETUP_INSTRUCTIONS.md** for detailed instructions and troubleshooting.

## Tech Stack

### Frontend
- React 18
- Vite (build tool)
- Tailwind CSS
- Axios (HTTP client)
- Lucide React (icons)

### Backend
- Node.js
- Express
- PostgreSQL 15
- pg (PostgreSQL client)
- CORS support

## Project Structure

```
accounting/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── config/         # Database connection
│   │   ├── models/         # Data layer (SQL queries)
│   │   ├── controllers/    # Business logic
│   │   ├── routes/         # API routes
│   │   └── server.js       # Express server
│   └── migrations/         # Database schema
├── frontend/               # React application
│   └── src/
│       ├── components/     # React components
│       └── services/       # API client
├── docker-compose.yml      # PostgreSQL setup
├── SETUP_INSTRUCTIONS.md   # Setup guide
└── TASKS/                  # Implementation tracking
```

## 📚 API Endpoints

### Entries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | Get all entries (sorted by date) |
| GET | `/api/entries/:id` | Get single entry by ID |
| GET | `/api/entries/income` | Get income entries only |
| GET | `/api/entries/expenses` | Get non-employee expense entries |
| GET | `/api/entries/salaries` | Get employee salary entries |
| GET | `/api/entries/totals` | Get financial totals and balance |
| GET | `/api/entries/forecast` | Get end-of-month forecast |
| GET | `/api/entries/scheduled` | Get pending/scheduled entries |
| POST | `/api/entries` | Create new entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry |
| DELETE | `/api/entries/bulk` | Bulk delete entries |
| PUT | `/api/entries/bulk/status` | Bulk update entry status |

### Employees

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all employees (with stats) |
| GET | `/api/employees?active=true\|false` | Filter by active status |
| GET | `/api/employees/:id` | Get single employee with stats |
| POST | `/api/employees` | Create new employee |
| PUT | `/api/employees/:id` | Update employee |
| POST | `/api/employees/:id/terminate` | Terminate employee + optional entry |
| POST | `/api/employees/:id/reactivate` | Reactivate employee |
| POST | `/api/employees/:id/calculate-severance` | Calculate severance pay |
| DELETE | `/api/employees/:id` | Delete employee (hard delete) |
| DELETE | `/api/employees/bulk` | Bulk delete employees |
| POST | `/api/employees/bulk/terminate` | Bulk terminate employees |
| POST | `/api/employees/bulk/reactivate` | Bulk reactivate employees |

### Contracts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts` | Get all contracts |
| GET | `/api/contracts/:id` | Get single contract |
| POST | `/api/contracts` | Create new contract |
| PUT | `/api/contracts/:id` | Update contract |
| DELETE | `/api/contracts/:id` | Delete contract |
| POST | `/api/contracts/:id/generate-entries` | Generate income entries |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics (excludes Transfers) |
| GET | `/api/dashboard/monthly-stats` | Monthly income/expense breakdown |
| GET | `/api/dashboard/top-expenses` | Top 10 expenses with currency info |
| GET | `/api/dashboard/vendor-breakdown` | Expenses grouped by vendor |
| GET | `/api/dashboard/category-breakdown` | Pie chart data by category |
| GET | `/api/dashboard/category-comparison` | Month-over-month comparison |
| GET | `/health` | Health check |

### Wise Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wise/sync` | Full historical transaction sync |
| POST | `/api/wise/sync/manual` | Incremental transaction sync |
| POST | `/api/wise/backfill-amount-usd` | Migrate existing entries with USD equivalents |
| GET | `/api/wise/test-connection` | Test database connection |

## 💾 Database Schema

### entries
Stores all financial transactions (income, expenses, salaries)

```sql
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    detail TEXT,
    base_amount DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',           -- Original currency (USD, PLN, EUR, GBP)
    amount_usd DECIMAL(12, 2),                   -- USD equivalent for comparison
    exchange_rate DECIMAL(10, 6),                -- Rate applied for conversion
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'pending')),
    employee_id INTEGER REFERENCES employees(id),
    contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### employees
Stores employee information and pay rates

```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    pay_type VARCHAR(20) NOT NULL CHECK (pay_type IN ('monthly', 'weekly', 'hourly')),
    pay_rate DECIMAL(12, 2) NOT NULL,
    pay_multiplier DECIMAL(5, 2) DEFAULT 1.0,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    termination_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### contracts
Stores recurring income contracts

```sql
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('monthly', 'yearly', 'one-time')),
    payment_day INTEGER CHECK (payment_day BETWEEN 1 AND 31),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_generated_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Relationships
- `entries.employee_id` → `employees.id` (FK, nullable)
- `entries.contract_id` → `contracts.id` (FK, nullable, CASCADE on delete)
- An entry can be linked to either an employee (salary) or contract (recurring income)

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://accounting_user:accounting_pass@localhost:5432/accounting_db
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
```

## Documentation

- **SETUP_INSTRUCTIONS.md** - Complete setup guide with troubleshooting
- **BALANCE_RECONCILIATION_GUIDE.md** - Understanding and fixing discrepancies between Wise bank balance and accounting records
- **TASKS/001-implement-date-tracking.md** - Date tracking implementation details
- **accounting-roadmap (1).md** - Future features roadmap
- **claude-code-instructions (1).md** - Development guidelines

## 🎯 Future Enhancements

### Planned Features
- [x] Multi-currency support (Completed November 2025)
- [ ] Tax calculation and reporting
- [ ] Invoice generation (PDF)
- [ ] Export to CSV/Excel
- [ ] Charts and visualizations
- [ ] Budget tracking and alerts
- [ ] Search and advanced filtering
- [ ] User authentication
- [ ] Role-based access control
- [ ] Email notifications
- [ ] Recurring expense automation
- [ ] Financial year management
- [ ] Backup and restore
- [ ] Audit log
- [ ] Mobile app

### Completed Features (Latest First)
1. ✅ **Salary Calendar View** - Visual monthly calendar with weekly summaries
2. ✅ **Bulk Operations** - Multi-select delete, status update, terminate, reactivate
3. ✅ **Contract System** - Recurring income with auto-generation
4. ✅ **Employee Management** - Full CRUD with termination and severance
5. ✅ **Dashboard** - Financial widgets and forecasting
6. ✅ **Status Tracking** - Completed vs pending entries
7. ✅ **Date Tracking** - Full date support for all entries
8. ✅ **PostgreSQL Integration** - Persistent data storage
9. ✅ **RESTful API** - Complete backend API
10. ✅ **React Frontend** - Modern UI with Tailwind CSS

## 📊 Components Overview

### Frontend Components (8 total)
- **AccountingApp.jsx** - Main application wrapper with routing
- **SalaryCalendar.jsx** - Visual calendar view for salary payments
- **EmployeeList.jsx** - Employee management table with bulk operations
- **EmployeeForm.jsx** - Employee create/edit form
- **EmployeeTerminationModal.jsx** - Termination workflow with severance
- **ContractList.jsx** - Contract management table
- **ContractForm.jsx** - Contract create/edit form
- **DashboardView.jsx** - Financial overview dashboard

### Backend Structure
- **Models** (4): entryModel, employeeModel, contractModel, dashboardModel
- **Controllers** (4): entryController, employeeController, contractController, dashboardController
- **Routes** (4): entryRoutes, employeeRoutes, contractRoutes, dashboardRoutes
- **Migrations** (8): Complete database schema evolution

## Development Commands

```bash
# Start PostgreSQL only
docker-compose up -d postgres

# Backend development
cd backend && npm run dev

# Frontend development
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Database backup
docker exec accounting_db pg_dump -U accounting_user accounting_db > backup.sql
```

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `docker ps`
- Verify .env file exists: `ls backend/.env`
- Check port 3001 is free: `lsof -i :3001`

### Frontend can't connect
- Verify backend is running on http://localhost:3001
- Check browser console for errors
- Verify .env file: `cat frontend/.env`

### Database issues
- Check connection: `docker exec -it accounting_db psql -U accounting_user -d accounting_db`
- Verify table exists: `\d entries`
- Re-run migration if needed

See **SETUP_INSTRUCTIONS.md** for detailed troubleshooting.

## Support

For issues:
1. Check SETUP_INSTRUCTIONS.md
2. Review logs: `docker-compose logs -f`
3. Check database: `docker exec -it accounting_db psql -U accounting_user -d accounting_db`

## 📝 Development Status & Current Work

### Recent Progress (November 2025)

#### ✅ Critical Bug Fixes (November 29, 2025)

**Currency Conversion in Dashboard**
- Fixed multi-currency comparison bug where amounts in different currencies (USD, PLN, EUR) were compared without conversion
- A 14,499 PLN expense (~$3,973 USD) was incorrectly ranking above actual $5,000 USD expenses
- Updated all dashboard queries to use `COALESCE(amount_usd, total)` for proper comparison
- Added exchange rate API integration with 1-hour caching
- Frontend now shows original currency below USD equivalent (e.g., "14,499 PLN")

**Cash Flow Calculation Fix**
- Fixed incorrect cash flow showing -$276,476 instead of -$2,305
- Root cause: Internal "Transfers" (Wise currency conversions) were counted as business expenses
- $274,171 in Transfers were incorrectly inflating expenses
- Added `category != 'Transfers'` filter to exclude internal account movements

**Wise Sync Enhancement**
- All new transactions now automatically populate `amount_usd` and `exchange_rate`
- Added `/api/wise/backfill-amount-usd` endpoint for migrating existing data
- Successfully backfilled 323 existing entries with USD equivalents

**Files Modified:**
- `backend/src/models/dashboardModel.js` - All queries updated for multi-currency
- `backend/src/routes/wiseSync_new.js` - Exchange rate helper + backfill endpoint
- `frontend/src/components/TopExpensesList.jsx` - Original currency display

### Previous Progress (October 2025)

#### ✅ Multi-Currency & Wise Integration
- **Wise Balance Tracking** - Multi-currency balance display (USD, EUR, PLN) with conversion to USD
- **CSV Import Functionality** - Manual CSV upload for Wise transactions with automatic classification
- **WiseImport Component** - Professional upload modal with validation and error handling
- **Import Statistics** - Real-time feedback on imported/skipped/error counts
- **Duplicate Prevention** - Automatic detection by Wise transaction ID

#### ✅ Employee Management Enhancements
- **Bulk Operations** - Multi-select for delete, terminate, reactivate operations
- **Severance Calculations** - Automatic pay calculation based on days worked
- **Employee Statistics** - Total paid, entry count, last payment tracking
- **Termination Workflow** - Soft delete with optional severance entry creation

#### ✅ Database Optimization
- **Connection Pool Configuration** - Resolved connection exhaustion issues
  - Max connections: 5 (Railway free tier optimized)
  - Idle timeout: 30 seconds
  - Connection timeout: 10 seconds
- **Diagnostic Endpoint** - `GET /api/wise/test-connection` for troubleshooting
- **Enhanced Error Handling** - Detailed logging and user-friendly error messages

### Wise API Integration Challenge

#### Initial Implementation
Implemented full Wise API integration with:
- Real-time transaction sync via Wise API
- Webhook-based balance updates
- SCA (Strong Customer Authentication) flow
- Transaction review and classification queue
- Automated sync scheduling

**Components Built:**
- Backend (8 files): Services, controllers, routes, webhook handlers, SCA signing
- Frontend (1 component): Transaction review UI
- Scripts (5 files): Testing, monitoring, webhook creation

#### Pivot to Manual CSV Import
After encountering persistent challenges with Wise API communication, made strategic decision to:
- **Remove full API integration** - Deleted all Wise API service files
- **Implement CSV upload** - Manual import workflow via exported CSV files
- **Retain classification logic** - Automatic transaction categorization
- **Keep database models** - Transaction tracking and balance management

**CSV Import Workflow:**
1. User exports CSV from Wise.com (Account → Statements → Export CSV)
2. Upload via dashboard modal with drag-and-drop interface
3. Backend parses 21-column Wise CSV format
4. Automatic transaction classification (income/expense)
5. Duplicate prevention by Wise transaction ID
6. Bulk insert with database transaction
7. Balance auto-update after successful import

### Current Blocker: Wise API Communication

#### Technical Challenges Encountered
1. **SCA Authentication Complexity** - Strong Customer Authentication flow integration issues
2. **Webhook Signature Validation** - RSA signature verification challenges
3. **API Communication Errors** - Connection and authorization problems
4. **Real-time Sync Reliability** - Maintaining consistent sync state

#### Issues Resolved During CSV Implementation
- **Database Connection Pool Exhaustion** - Fixed with proper pool configuration
- **Variable Naming Inconsistency** - Standardized database import patterns
- **CSV Format Validation** - 21-column Wise export format verification
- **Error Message Clarity** - Enhanced user feedback and troubleshooting

**Documentation Created:**
- `WISE_API_CHANGES.pdf` - 10-page technical document covering all changes, issues, and solutions
- Comprehensive logging for production debugging
- Diagnostic endpoints for connection testing

### Freelancer Solution Approach

#### Current Strategy
Given the complexity of Wise API integration, a **freelance developer has been hired** to:
1. Implement working Wise API connection
2. Establish reliable real-time transaction sync
3. Handle SCA authentication flow properly
4. Set up webhook infrastructure correctly
5. Deliver fully functional source code

#### Next Steps After Freelancer Delivery
Once the freelancer provides the working solution:

1. **Code Review & Analysis**
   - Examine freelancer's implementation approach
   - Understand authentication flow and API patterns
   - Review webhook handling and signature validation
   - Identify key differences from previous attempt

2. **Integration Planning**
   - Map freelancer's code to existing codebase structure
   - Plan migration from CSV import to API sync
   - Determine backward compatibility requirements
   - Design testing strategy

3. **Implementation**
   - Apply freelancer's solution to this codebase
   - Integrate with existing database models
   - Preserve CSV import as fallback option
   - Update frontend components for real-time sync

4. **Testing & Validation**
   - Test SCA authentication flow end-to-end
   - Verify webhook signature validation
   - Test transaction sync accuracy
   - Monitor connection pool stability
   - Validate multi-currency handling

5. **Documentation & Deployment**
   - Document new API integration approach
   - Update README with API setup instructions
   - Create deployment checklist
   - Add monitoring and alerting

#### Interim Solution
Until Wise API is fully functional:
- ✅ **CSV Import Available** - Users can manually upload Wise transaction exports
- ✅ **Balance Tracking** - Multi-currency balances displayed in dashboard
- ✅ **Transaction Classification** - Automatic categorization working
- ✅ **No Data Loss** - All transactions properly stored and tracked

**Status:** ⏳ **Waiting for freelancer's working Wise API solution**

---

## License

Private project for business use.
