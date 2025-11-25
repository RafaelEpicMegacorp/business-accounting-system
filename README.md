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
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/health` | Health check |

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
- [ ] Multi-currency support
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

## License

Private project for business use.
