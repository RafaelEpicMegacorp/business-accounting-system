# Internal API Reference

Complete documentation for the Accounting System backend API.

**Base URL**: `http://localhost:3001` (development)
**Production URL**: `https://business-accounting-system-production.up.railway.app`

**Authentication**: JWT Bearer token (except login endpoint)
**Content-Type**: `application/json`

---

## Table of Contents

- [Authentication](#authentication)
- [Entries](#entries)
- [Employees](#employees)
- [Contracts](#contracts)
- [Dashboard](#dashboard)
- [Currency](#currency)
- [Wise Import](#wise-import)
- [System](#system)

---

## Authentication

### POST /api/auth/login
**Public** - No authentication required

Login with username and password to receive JWT token.

**Request Body:**
```json
{
  "username": "rafael",
  "password": "asdflkj@3!"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "rafael",
    "name": "Rafael"
  }
}
```

**Implementation:**
- Controller: `backend/src/controllers/authController.js:login`
- Route: `backend/src/routes/authRoutes.js:7`

---

### GET /api/auth/me
**Protected** - Requires authentication

Get current user information from JWT token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "username": "rafael",
  "name": "Rafael"
}
```

**Implementation:**
- Controller: `backend/src/controllers/authController.js:me`
- Route: `backend/src/routes/authRoutes.js:10`
- Middleware: `backend/src/middleware/auth.js`

---

### POST /api/auth/logout
**Protected** - Requires authentication

Logout current user (token invalidation handled client-side).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

**Implementation:**
- Controller: `backend/src/controllers/authController.js:logout`
- Route: `backend/src/routes/authRoutes.js:11`

---

## Entries

All entry endpoints require authentication.

### GET /api/entries
Get all entries with optional search and filtering.

**Query Parameters:**
- `startDate` (optional): Filter by date range start (YYYY-MM-DD)
- `endDate` (optional): Filter by date range end (YYYY-MM-DD)
- `search` (optional): Search across description, category, and employee name (case-insensitive)
- `categories` (optional): Array of category names (can pass multiple: `categories=Software&categories=Marketing`)
- `employeeId` (optional): Filter by specific employee ID
- `minAmount` (optional): Minimum total amount
- `maxAmount` (optional): Maximum total amount
- `status` (optional): `completed`, `pending`, or `all` (default: all)
- `currency` (optional): `USD`, `EUR`, `PLN`, `GBP`, or `all` (default: all)

**Response:**
```json
[
  {
    "id": 1,
    "type": "income",
    "category": "consulting",
    "description": "Monthly retainer",
    "detail": "Client ABC",
    "base_amount": 5000.00,
    "total": 5000.00,
    "entry_date": "2025-01-15",
    "status": "completed",
    "employee_id": null,
    "employee_name": null,
    "pay_type": null,
    "contract_id": 1,
    "currency": "USD",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

**Examples:**

Basic date filtering:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/entries?startDate=2025-01-01&endDate=2025-01-31"
```

Search with filters:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/entries?search=office&minAmount=100&maxAmount=1000"
```

Multiple categories:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/entries?categories=Software&categories=Marketing&status=completed"
```

Employee filter:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/entries?employeeId=5&currency=USD"
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getAll`
- Model: `backend/src/models/entryModel.js`
- Route: `backend/src/routes/entryRoutes.js:20`

---

### GET /api/entries/:id
Get single entry by ID.

**Path Parameters:**
- `id`: Entry ID

**Response:**
```json
{
  "id": 1,
  "type": "income",
  "category": "consulting",
  "description": "Monthly retainer",
  "total": 5000.00,
  ...
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getById`
- Route: `backend/src/routes/entryRoutes.js:21`

---

### POST /api/entries
Create new entry.

**Request Body:**
```json
{
  "type": "expense",
  "category": "office_supplies",
  "description": "Office chairs",
  "detail": "5x ergonomic chairs",
  "base_amount": 1500.00,
  "total": 1500.00,
  "entry_date": "2025-01-20",
  "status": "completed",
  "currency": "USD"
}
```

**Response:**
```json
{
  "id": 42,
  "type": "expense",
  "category": "office_supplies",
  ...
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:create`
- Route: `backend/src/routes/entryRoutes.js:22`

---

### PUT /api/entries/:id
Update existing entry.

**Path Parameters:**
- `id`: Entry ID

**Request Body:** (all fields optional)
```json
{
  "description": "Updated description",
  "total": 1600.00,
  "status": "pending"
}
```

**Response:** Updated entry object

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:update`
- Route: `backend/src/routes/entryRoutes.js:23`

---

### DELETE /api/entries/:id
Delete single entry.

**Path Parameters:**
- `id`: Entry ID

**Response:**
```json
{
  "message": "Entry deleted successfully"
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:delete`
- Route: `backend/src/routes/entryRoutes.js:24`

---

### DELETE /api/entries/bulk
Delete multiple entries.

**Request Body:**
```json
{
  "ids": [1, 2, 3, 4]
}
```

**Response:**
```json
{
  "message": "4 entries deleted successfully",
  "count": 4
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:bulkDelete`
- Route: `backend/src/routes/entryRoutes.js:18`

---

### PUT /api/entries/bulk/status
Update status for multiple entries.

**Request Body:**
```json
{
  "ids": [1, 2, 3],
  "status": "completed"
}
```

**Response:**
```json
{
  "message": "3 entries updated successfully",
  "count": 3
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:bulkUpdateStatus`
- Route: `backend/src/routes/entryRoutes.js:19`

---

### GET /api/entries/totals
Get financial totals and balance.

**Response:**
```json
{
  "totalIncome": 150000.00,
  "totalExpenses": 85000.00,
  "balance": 65000.00,
  "pendingIncome": 5000.00,
  "pendingExpenses": 2000.00
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getTotals`
- Route: `backend/src/routes/entryRoutes.js:10`

---

### GET /api/entries/income
Get income entries only with optional search and filtering.

**Query Parameters:** Same as GET /api/entries
- `startDate` (optional): Filter by date range start (YYYY-MM-DD)
- `endDate` (optional): Filter by date range end (YYYY-MM-DD)
- `search` (optional): Search across description, category, and employee name
- `categories` (optional): Array of category names
- `employeeId` (optional): Filter by specific employee ID
- `minAmount` (optional): Minimum total amount
- `maxAmount` (optional): Maximum total amount
- `status` (optional): `completed`, `pending`, or `all`
- `currency` (optional): `USD`, `EUR`, `PLN`, `GBP`, or `all`

**Response:** Array of income entries

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/entries/income?search=consulting&minAmount=5000"
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getIncome`
- Route: `backend/src/routes/entryRoutes.js:13`

---

### GET /api/entries/expenses
Get expense entries (excluding employee salaries) with optional search and filtering.

**Query Parameters:** Same as GET /api/entries
- `startDate` (optional): Filter by date range start (YYYY-MM-DD)
- `endDate` (optional): Filter by date range end (YYYY-MM-DD)
- `search` (optional): Search across description, category, and employee name
- `categories` (optional): Array of category names
- `employeeId` (optional): Filter by specific employee ID
- `minAmount` (optional): Minimum total amount
- `maxAmount` (optional): Maximum total amount
- `status` (optional): `completed`, `pending`, or `all`
- `currency` (optional): `USD`, `EUR`, `PLN`, `GBP`, or `all`

**Response:** Array of expense entries

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/entries/expenses?categories=Software&categories=Marketing&status=completed"
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getExpenses`
- Route: `backend/src/routes/entryRoutes.js:14`

---

### GET /api/entries/salaries
Get employee salary entries only with optional search and filtering.

**Query Parameters:** Same as GET /api/entries
- `startDate` (optional): Filter by date range start (YYYY-MM-DD)
- `endDate` (optional): Filter by date range end (YYYY-MM-DD)
- `search` (optional): Search across description and employee name
- `employeeId` (optional): Filter by specific employee ID
- `minAmount` (optional): Minimum total amount
- `maxAmount` (optional): Maximum total amount
- `status` (optional): `completed`, `pending`, or `all`
- `currency` (optional): `USD`, `EUR`, `PLN`, `GBP`, or `all`

**Response:** Array of salary entries with employee details

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/entries/salaries?employeeId=5&status=pending"
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getSalaries`
- Route: `backend/src/routes/entryRoutes.js:15`

---

### GET /api/entries/scheduled
Get pending/scheduled entries.

**Response:** Array of pending entries sorted by date

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getScheduled`
- Route: `backend/src/routes/entryRoutes.js:11`

---

### GET /api/entries/forecast
Get end-of-month financial forecast.

**Response:**
```json
{
  "currentBalance": 65000.00,
  "projectedIncome": 10000.00,
  "projectedExpenses": 15000.00,
  "forecastBalance": 60000.00,
  "weeklyBreakdown": [
    {
      "week": 1,
      "expenses": 3500.00,
      "entries": [...]
    }
  ]
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:getForecast`
- Route: `backend/src/routes/entryRoutes.js:12`

---

### POST /api/entries/generate-salary-entries
Auto-generate missing salary entries for active employees.

**Response:**
```json
{
  "message": "Generated 15 salary entries",
  "count": 15,
  "entries": [...]
}
```

**Important:**
- Automatically cleans up incorrect Sunday entries for weekly employees
- Generates weekly entries on Fridays (end of work week)
- Generates monthly entries on last day of month
- Weekly pay calculation: monthly rate ÷ 4

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:generateSalaryEntries`
- Route: `backend/src/routes/entryRoutes.js:16`

---

### POST /api/entries/cleanup-weekly
**Admin only** - Clean up incorrect weekly salary entries.

Removes Sunday entries for weekly employees (historical bug cleanup).

**Response:**
```json
{
  "message": "Cleaned up 8 incorrect entries",
  "count": 8
}
```

**Implementation:**
- Controller: `backend/src/controllers/entryController.js:cleanupWeeklyEntries`
- Route: `backend/src/routes/entryRoutes.js:17`

---

## Employees

All employee endpoints require authentication.

### GET /api/employees
Get all employees with optional filtering.

**Query Parameters:**
- `active` (optional): `true` or `false` - Filter by active status

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "position": "Developer",
    "pay_type": "monthly",
    "pay_rate": 5000.00,
    "pay_multiplier": 1.12,
    "start_date": "2024-01-15",
    "termination_date": null,
    "is_active": true,
    "total_paid": 60000.00,
    "payment_count": 12,
    "created_at": "2024-01-10T10:00:00Z"
  }
]
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:getAll`
- Route: `backend/src/routes/employeeRoutes.js:15`

---

### GET /api/employees/active
Get active employees only (convenience endpoint).

Equivalent to `GET /api/employees?active=true`

**Implementation:**
- Route: `backend/src/routes/employeeRoutes.js:18-21`

---

### GET /api/employees/:id
Get single employee by ID with statistics.

**Path Parameters:**
- `id`: Employee ID

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "total_paid": 60000.00,
  "payment_count": 12,
  "last_payment_date": "2025-01-31",
  "last_payment_amount": 5600.00,
  ...
}
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:getById`
- Route: `backend/src/routes/employeeRoutes.js:24`

---

### POST /api/employees
Create new employee.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "position": "Designer",
  "pay_type": "weekly",
  "pay_rate": 3000.00,
  "pay_multiplier": 1.0,
  "start_date": "2025-02-01"
}
```

**Response:** Created employee object

**Pay Types:**
- `monthly`: Pay rate is monthly salary
- `weekly`: Pay rate is MONTHLY salary (divided by 4 for weekly amount)
- `hourly`: Pay rate is hourly rate (requires hours tracking)

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:create`
- Route: `backend/src/routes/employeeRoutes.js:27`

---

### PUT /api/employees/:id
Update employee information.

**Path Parameters:**
- `id`: Employee ID

**Request Body:** (all fields optional)
```json
{
  "position": "Senior Designer",
  "pay_rate": 3500.00,
  "pay_multiplier": 1.15
}
```

**Response:** Updated employee object

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:update`
- Route: `backend/src/routes/employeeRoutes.js:30`

---

### DELETE /api/employees/:id
**Hard delete** - Delete employee (only if no payment entries exist).

**Path Parameters:**
- `id`: Employee ID

**Response:**
```json
{
  "message": "Employee deleted successfully"
}
```

**Error Response (if entries exist):**
```json
{
  "error": "Cannot delete employee with existing payment entries. Use terminate instead."
}
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:delete`
- Route: `backend/src/routes/employeeRoutes.js:42`

---

### POST /api/employees/:id/terminate
Terminate employee with optional severance payment.

**Path Parameters:**
- `id`: Employee ID

**Request Body:**
```json
{
  "termination_date": "2025-02-28",
  "create_severance_entry": true,
  "severance_amount": 5600.00,
  "severance_description": "Severance payment - 1 month"
}
```

**Response:**
```json
{
  "message": "Employee terminated successfully",
  "employee": {...},
  "severance_entry": {...}
}
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:terminate`
- Route: `backend/src/routes/employeeRoutes.js:36`

---

### POST /api/employees/:id/reactivate
Reactivate terminated employee.

**Path Parameters:**
- `id`: Employee ID

**Response:**
```json
{
  "message": "Employee reactivated successfully",
  "employee": {...}
}
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:reactivate`
- Route: `backend/src/routes/employeeRoutes.js:39`

---

### POST /api/employees/:id/calculate-severance
Calculate severance pay for employee.

**Path Parameters:**
- `id`: Employee ID

**Response:**
```json
{
  "employee_id": 1,
  "pay_type": "monthly",
  "pay_rate": 5000.00,
  "pay_multiplier": 1.12,
  "calculated_amount": 5600.00,
  "payment_due_date": "2025-02-28",
  "description": "Severance calculation based on pay type"
}
```

**Payment Schedule:**
- **Monthly employees**: End of current month
- **Weekly employees**: Next Friday
- **Hourly employees**: Immediate (same day)

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:calculateSeverance`
- Route: `backend/src/routes/employeeRoutes.js:33`

---

### DELETE /api/employees/bulk
Bulk delete employees.

**Request Body:**
```json
{
  "ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "message": "3 employees deleted successfully",
  "count": 3
}
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:bulkDelete`
- Route: `backend/src/routes/employeeRoutes.js:10`

---

### POST /api/employees/bulk/terminate
Bulk terminate employees.

**Request Body:**
```json
{
  "ids": [1, 2],
  "termination_date": "2025-03-31"
}
```

**Response:**
```json
{
  "message": "2 employees terminated successfully",
  "count": 2
}
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:bulkTerminate`
- Route: `backend/src/routes/employeeRoutes.js:11`

---

### POST /api/employees/bulk/reactivate
Bulk reactivate employees.

**Request Body:**
```json
{
  "ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "message": "3 employees reactivated successfully",
  "count": 3
}
```

**Implementation:**
- Controller: `backend/src/controllers/employeeController.js:bulkReactivate`
- Route: `backend/src/routes/employeeRoutes.js:12`

---

## Contracts

All contract endpoints require authentication.

### GET /api/contracts
Get all contracts.

**Response:**
```json
[
  {
    "id": 1,
    "client_name": "ABC Corp",
    "amount": 10000.00,
    "contract_type": "monthly",
    "payment_day": 15,
    "start_date": "2024-01-01",
    "end_date": null,
    "status": "active",
    "last_generated_date": "2025-01-15",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:getAll`
- Route: `backend/src/routes/contractRoutes.js:14`

---

### GET /api/contracts/active
Get active contracts only.

**Response:** Array of active contracts

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:getActive`
- Route: `backend/src/routes/contractRoutes.js:10`

---

### GET /api/contracts/:id
Get single contract by ID.

**Path Parameters:**
- `id`: Contract ID

**Response:** Contract object

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:getById`
- Route: `backend/src/routes/contractRoutes.js:13`

---

### POST /api/contracts
Create new contract.

**Request Body:**
```json
{
  "client_name": "XYZ Inc",
  "amount": 5000.00,
  "contract_type": "monthly",
  "payment_day": 1,
  "start_date": "2025-02-01",
  "end_date": null,
  "status": "active"
}
```

**Contract Types:**
- `monthly`: Recurring monthly payment
- `yearly`: Recurring yearly payment
- `one-time`: Single payment contract

**Response:** Created contract object

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:create`
- Route: `backend/src/routes/contractRoutes.js:15`

---

### PUT /api/contracts/:id
Update contract.

**Path Parameters:**
- `id`: Contract ID

**Request Body:** (all fields optional)
```json
{
  "amount": 5500.00,
  "status": "inactive"
}
```

**Response:** Updated contract object

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:update`
- Route: `backend/src/routes/contractRoutes.js:16`

---

### DELETE /api/contracts/:id
Delete contract (CASCADE deletes associated entries).

**Path Parameters:**
- `id`: Contract ID

**Response:**
```json
{
  "message": "Contract deleted successfully"
}
```

**Warning:** This will delete all income entries associated with this contract.

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:delete`
- Route: `backend/src/routes/contractRoutes.js:17`

---

### POST /api/contracts/:id/generate-entries
Generate income entries for contract based on schedule.

**Path Parameters:**
- `id`: Contract ID

**Response:**
```json
{
  "message": "Generated 3 income entries",
  "count": 3,
  "entries": [...]
}
```

**Generation Logic:**
- Checks `last_generated_date` to prevent duplicates
- Generates entries based on `contract_type` and `payment_day`
- Updates `last_generated_date` after generation

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:generateEntries`
- Route: `backend/src/routes/contractRoutes.js:12`

---

### GET /api/contracts/stats/revenue
Get revenue statistics from contracts.

**Response:**
```json
{
  "total_active_contracts": 5,
  "monthly_recurring_revenue": 25000.00,
  "yearly_recurring_revenue": 300000.00,
  "contracts_by_type": {
    "monthly": 4,
    "yearly": 1,
    "one-time": 0
  }
}
```

**Implementation:**
- Controller: `backend/src/controllers/contractController.js:getRevenue`
- Route: `backend/src/routes/contractRoutes.js:11`

---

## Dashboard

All dashboard endpoints require authentication.

### GET /api/dashboard/stats
Get dashboard statistics and overview.

**Response:**
```json
{
  "financial": {
    "totalIncome": 150000.00,
    "totalExpenses": 85000.00,
    "balance": 65000.00,
    "monthlyIncome": 25000.00,
    "monthlyExpenses": 15000.00
  },
  "employees": {
    "active": 8,
    "terminated": 2,
    "totalPayroll": 40000.00
  },
  "contracts": {
    "active": 5,
    "monthlyRevenue": 25000.00
  },
  "recentEntries": [...]
}
```

**Implementation:**
- Controller: `backend/src/controllers/dashboardController.js:getStats`
- Route: `backend/src/routes/dashboardRoutes.js:9`

---

### GET /api/dashboard/chart-data
Get data for income vs expense line chart.

**Query Parameters:**
- `startDate` (optional): Date range start (YYYY-MM-DD)
- `endDate` (optional): Date range end (YYYY-MM-DD)
- `groupBy` (optional): `day`, `week`, or `month` (default: `day`)

**Response:**
```json
{
  "labels": ["2025-01-01", "2025-01-02", ...],
  "income": [5000, 0, 10000, ...],
  "expenses": [2000, 1500, 3000, ...]
}
```

**Implementation:**
- Controller: `backend/src/controllers/dashboardController.js:getChartData`
- Route: `backend/src/routes/dashboardRoutes.js:10`

---

### GET /api/dashboard/category-breakdown
Get expense breakdown by category for pie chart.

**Query Parameters:**
- `startDate` (optional): Date range start (YYYY-MM-DD)
- `endDate` (optional): Date range end (YYYY-MM-DD)

**Response:**
```json
{
  "categories": ["salaries", "office_supplies", "software_subscriptions", ...],
  "amounts": [40000, 5000, 2000, ...],
  "percentages": [70.2, 8.8, 3.5, ...]
}
```

**Implementation:**
- Controller: `backend/src/controllers/dashboardController.js:getCategoryBreakdown`
- Route: `backend/src/routes/dashboardRoutes.js:11`

---

## Currency

Currency endpoints support multi-currency balance tracking (USD, EUR, PLN, GBP).

### GET /api/currency/balances
Get all currency balances.

**Response:**
```json
[
  {
    "id": 1,
    "currency": "USD",
    "balance": 50000.00,
    "balance_usd": 50000.00,
    "last_updated": "2025-01-20T10:00:00Z"
  },
  {
    "id": 2,
    "currency": "EUR",
    "balance": 15000.00,
    "balance_usd": 16500.00,
    "last_updated": "2025-01-20T10:00:00Z"
  }
]
```

**Implementation:**
- Model: `backend/src/models/currencyModel.js:getCurrencyBalances`
- Route: `backend/src/routes/currencyRoutes.js:6-14`

---

### GET /api/currency/balances/:currency
Get balance for specific currency.

**Path Parameters:**
- `currency`: Currency code (USD, EUR, PLN, GBP)

**Response:**
```json
{
  "id": 1,
  "currency": "USD",
  "balance": 50000.00,
  "balance_usd": 50000.00,
  "last_updated": "2025-01-20T10:00:00Z"
}
```

**Implementation:**
- Model: `backend/src/models/currencyModel.js:getBalanceByCurrency`
- Route: `backend/src/routes/currencyRoutes.js:28-42`

---

### GET /api/currency/summary
Get currency balance summary with totals.

**Response:**
```json
{
  "balances": [...],
  "totalBalanceUSD": 75000.00,
  "lastUpdated": "2025-01-20T10:00:00Z"
}
```

**Implementation:**
- Model: `backend/src/models/currencyModel.js:getCurrencySummary`
- Route: `backend/src/routes/currencyRoutes.js:17-25`

---

### GET /api/currency/total-usd
Get total balance in USD (all currencies converted).

**Response:**
```json
{
  "totalUSD": 75000.00,
  "breakdown": [
    {
      "currency": "USD",
      "balance": 50000.00,
      "balanceUSD": 50000.00
    },
    {
      "currency": "EUR",
      "balance": 15000.00,
      "balanceUSD": 16500.00
    }
  ],
  "calculatedAt": "2025-01-20T10:00:00Z"
}
```

**Implementation:**
- Model: `backend/src/models/currencyModel.js:getTotalBalanceInUSD`
- Route: `backend/src/routes/currencyRoutes.js:85-93`

---

### GET /api/currency/exchanges
Get currency exchange rate history.

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)

**Response:**
```json
[
  {
    "id": 1,
    "from_currency": "EUR",
    "to_currency": "USD",
    "rate": 1.10,
    "fetched_at": "2025-01-20T10:00:00Z"
  }
]
```

**Implementation:**
- Model: `backend/src/models/currencyModel.js:getCurrencyExchanges`
- Route: `backend/src/routes/currencyRoutes.js:45-54`

---

### GET /api/currency/entries/:currency
Get Wise entries for specific currency.

**Path Parameters:**
- `currency`: Currency code (USD, EUR, PLN, GBP)

**Query Parameters:**
- `limit` (optional): Number of entries (default: 50)

**Response:** Array of entry objects for specified currency

**Implementation:**
- Model: `backend/src/models/currencyModel.js:getWiseEntriesByCurrency`
- Route: `backend/src/routes/currencyRoutes.js:57-67`

---

### POST /api/currency/recalculate
Manually trigger balance recalculation for all currencies.

**Response:**
```json
{
  "success": true,
  "message": "Currency balances recalculated successfully",
  "balances": [...]
}
```

**Purpose:** Recalculates all currency balances based on entries and current exchange rates.

**Implementation:**
- Model: `backend/src/models/currencyModel.js:recalculateBalances`
- Route: `backend/src/routes/currencyRoutes.js:70-82`

---

## Wise Import

### POST /api/wise/import
**Protected** - Upload and import Wise CSV transaction file.

**Content-Type:** `multipart/form-data`

**Request Body:**
```
csvFile: <file> (Wise CSV export, 21-column format)
```

**CSV Format:** Must be Wise export with 21 columns:
1. ID, Status, Direction, Created on, Finished on
2. Source fee amount, Source fee currency, Target fee amount, Target fee currency
3. Source name, Source amount, Source currency
4. Target name, Target amount, Target currency
5. Exchange rate, Reference, Batch, Created by, Category, Note

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed 150 transactions",
  "summary": {
    "imported": 145,
    "skipped": 5,
    "errors": 0,
    "totalProcessed": 150
  },
  "balance": {
    "totalIncome": 200000.00,
    "totalExpenses": 100000.00,
    "netBalance": 100000.00,
    "totalEntries": 500
  }
}
```

**Error Responses:**
- 400: Invalid CSV format or missing file
- 500: Database connection error or import failure

**Import Logic:**
- Validates 21-column Wise CSV format
- Skips CANCELLED and REFUNDED transactions
- Checks for duplicate Wise IDs
- Categorizes transactions automatically
- Updates currency balances after import

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "csvFile=@wise_statement.csv" \
  http://localhost:3001/api/wise/import
```

**Implementation:**
- Route: `backend/src/routes/wiseImport.js:155-408`
- Category Mapping: `backend/src/routes/wiseImport.js:22-32`

---

### GET /api/wise/test-connection
**Protected** - Test database connection for diagnostics.

**Response:**
```json
{
  "success": true,
  "message": "Database connection test passed",
  "tests": {
    "poolQuery": "PASSED",
    "getClient": "PASSED",
    "clientQuery": "PASSED"
  },
  "poolStats": {
    "totalCount": 2,
    "idleCount": 1,
    "waitingCount": 0
  },
  "database": "accounting_db",
  "timestamp": "2025-01-20T10:00:00Z"
}
```

**Purpose:** Diagnostic endpoint to troubleshoot database connection issues during CSV import.

**Implementation:**
- Route: `backend/src/routes/wiseImport.js:95-152`

---

## System

### GET /health
**Public** - Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:00:00Z",
  "uptime": 3600
}
```

**Implementation:**
- Server: `backend/src/server.js`

---

## Error Responses

All endpoints follow standard HTTP status codes and return errors in this format:

```json
{
  "error": "Error message description",
  "details": "Additional error details (optional)"
}
```

### Common Status Codes
- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **204 No Content**: Successful deletion
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

---

## Authentication Flow

1. **Login**: `POST /api/auth/login` → Receive JWT token
2. **Store Token**: Save token in client (memory, localStorage)
3. **Include in Requests**: Add `Authorization: Bearer <token>` header
4. **Token Expiration**: Handle 401 errors and re-login
5. **Logout**: `POST /api/auth/logout` → Clear token client-side

---

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing rate limiting in production.

---

## CORS Configuration

Development CORS origins configured in backend `.env`:
```
CORS_ORIGINS=http://localhost:5173,http://localhost:7392
```

Production:
```
CORS_ORIGINS=https://ds-accounting.netlify.app
```

---

## Database Connection

**Pool Configuration:**
- Max connections: 5
- Idle timeout: 30 seconds
- Connection timeout: 10 seconds

**Important:** CSV import uses `pool.getClient()` which holds connections. Pool limits prevent connection exhaustion.

---

## File Structure Reference

```
backend/src/
├── controllers/
│   ├── authController.js       # Authentication endpoints
│   ├── entryController.js      # Entry CRUD operations
│   ├── employeeController.js   # Employee management
│   ├── contractController.js   # Contract management
│   └── dashboardController.js  # Dashboard statistics
├── models/
│   ├── entryModel.js           # Entry database operations
│   ├── employeeModel.js        # Employee database operations
│   ├── contractModel.js        # Contract database operations
│   ├── dashboardModel.js       # Dashboard queries
│   ├── currencyModel.js        # Currency operations
│   └── wiseTransactionModel.js # Wise transaction tracking
├── routes/
│   ├── authRoutes.js           # Auth endpoints
│   ├── entryRoutes.js          # Entry endpoints
│   ├── employeeRoutes.js       # Employee endpoints
│   ├── contractRoutes.js       # Contract endpoints
│   ├── dashboardRoutes.js      # Dashboard endpoints
│   ├── currencyRoutes.js       # Currency endpoints
│   └── wiseImport.js           # Wise CSV import
├── middleware/
│   └── auth.js                 # JWT verification middleware
└── server.js                   # Express server setup
```

---

## Related Documentation

- [Wise API Reference](WISE_API_REFERENCE.md) - External Wise API integration
- [Quick Reference](API_QUICK_REFERENCE.md) - Fast lookup table
- [Database Schema](../ARCHITECTURE/DATABASE_SCHEMA.md) - Complete database schema

---

**Last Updated:** 2025-10-27
**API Version:** 1.0
**Total Endpoints:** 50
