# Business Accounting System - Features Guide

A comprehensive guide to all features and functionality in the Business Accounting System.

## Table of Contents

1. [Dashboard](#dashboard)
2. [Payroll Dashboard](#payroll-dashboard)
3. [Employee Management](#employee-management)
4. [Project Management](#project-management)
5. [Contracts](#contracts)
6. [Entries (Income/Expenses/Salaries)](#entries)
7. [Salary Calendar](#salary-calendar)
8. [Transaction Review](#transaction-review)
9. [Forecast View](#forecast-view)
10. [Wise Integration](#wise-integration)

---

## Dashboard

The main overview page providing at-a-glance financial metrics and quick access to all system features.

### Features

- **Total Wise Balance** - Multi-currency balance from Wise account converted to USD
- **Currency Breakdown** - Individual balances per currency (USD, EUR, PLN, etc.)
- **Income Summary** - Total completed and pending income
- **Expense Summary** - Total completed and pending expenses
- **End-of-Month Forecast** - Predicted balance at month end
- **Quick Navigation** - Links to detailed views for each section

### Metrics Displayed

| Metric | Description |
|--------|-------------|
| Wise Balance | Real-time balance from Wise account in USD equivalent |
| Total Income | Sum of all completed income entries |
| Total Expenses | Sum of all completed expense entries |
| Forecasted Balance | Projected balance at end of current month |
| Weekly Payments | Total weekly recurring payments |
| Monthly Payments | Total monthly recurring payments |

---

## Payroll Dashboard

Dedicated dashboard for managing and visualizing employee costs across projects.

### Summary Cards

- **Total Monthly Payroll** - Sum of all active employee costs per month
- **Active Employees** - Count of currently active employees
- **Projects with Staff** - Number of projects with assigned employees
- **Terminated History** - Count of terminated employees (with access to history)

### Cost by Pay Type

Breakdown of monthly costs by employee pay structure:

| Pay Type | Calculation |
|----------|-------------|
| Monthly | Direct rate (rate x 1) |
| Weekly | Rate x 4.33 weeks/month |
| Hourly | Rate x 160 hours/month |

### Cost by Project

- Expandable sections for each project
- Shows all employees assigned to each project
- Displays individual employee costs within each project
- Calculates total monthly cost per project
- Respects employee allocation percentages

### Per-Employee Table

| Column | Description |
|--------|-------------|
| Name | Employee name |
| Position | Job title/role |
| Projects | Assigned project(s) |
| Pay Type | Monthly/Weekly/Hourly |
| Rate | Base pay rate |
| Multiplier | Pay multiplier (default 1.0) |
| Monthly Cost | Calculated monthly cost |

### Terminated History

- Collapsible section showing former employees
- Displays termination date for each
- Useful for historical reference and rehiring

---

## Employee Management

Complete employee lifecycle management from hiring to termination.

### Employee List

**Filter Tabs:**
- **Active** - Currently employed staff
- **Terminated** - Former employees (soft deleted)
- **All** - Complete list

**Displayed Information:**
- Name and email
- Position/role
- Pay type and rate
- Pay multiplier
- Start date
- Assigned projects
- Payment statistics (total paid, last payment)

### Add/Edit Employee

**Required Fields:**
- Name
- Pay type (Monthly/Weekly/Hourly)
- Pay rate
- Start date

**Optional Fields:**
- Email
- Position
- Pay multiplier (default 1.0)
- Project assignments (multi-select)

### Project Assignment

- Multi-select dropdown to assign employees to projects
- Allocation percentage per project (default 100%)
- Employees can be assigned to multiple projects
- Project costs calculated based on allocation

### Termination Workflow

1. Select employee(s) to terminate
2. Set termination date
3. Review severance calculation:
   - Days worked since last payment
   - Prorated amount based on pay type
   - Editable severance amount
4. Optional: Create expense entry for severance payment
5. Confirm termination

**Severance Calculation Formula:**
- Monthly: (Days worked / Days in month) x Monthly rate
- Weekly: (Days worked / 7) x Weekly rate
- Hourly: Days worked x 8 hours x Hourly rate

### Bulk Operations

| Operation | Description |
|-----------|-------------|
| Bulk Terminate | Terminate multiple employees at once |
| Bulk Reactivate | Restore multiple terminated employees |
| Bulk Delete | Permanently delete multiple employees |

**Selection:**
- Checkbox-based selection
- "Select All" option
- Visual feedback for selected items

---

## Project Management

Organize work and track costs by project.

### Project List

- **Active Projects** - Current ongoing projects
- **Archived Projects** - Completed/paused projects
- Color-coded project cards
- Employee count per project
- Monthly cost per project

### Project Details Modal

Click any project to view:
- Project description
- All assigned employees
- Individual employee costs
- Total monthly project cost

### Employee Assignment

**From Project View:**
1. Click project to open details
2. Click "Manage Employees"
3. Add/remove employees
4. Set allocation percentage

**From Employee View:**
1. Edit employee
2. Select projects in multi-select dropdown
3. Save changes

### Cost Tracking

- Real-time cost calculation
- Only includes active (non-terminated) employees
- Respects allocation percentages
- Updates automatically when:
  - Employees are added/removed
  - Pay rates change
  - Allocations change

### Delete Protection

- Cannot delete projects with assigned employees
- Must remove all employees first
- Prevents orphaned employee-project relationships

---

## Contracts

Manage recurring income from clients with automatic entry generation.

### Contract Types

| Type | Behavior |
|------|----------|
| Monthly | Generates entry on specified day each month |
| Yearly | Generates entry once per year on start date |
| One-time | Single entry generation |

### Contract Fields

- **Client Name** - Name of paying client
- **Amount** - Payment amount
- **Contract Type** - Monthly/Yearly/One-time
- **Payment Day** - Day of month for payment (1-31)
- **Start Date** - When contract begins
- **End Date** - When contract expires (optional)
- **Status** - Active/Inactive

### Auto-Generation

- System automatically generates income entries based on contract schedule
- Past-due entries marked as completed automatically
- Future entries marked as pending
- Contract badge displayed on generated entries

### Manual Entry Generation

1. Go to Contracts tab
2. Click "Generate Entries" on specific contract
3. System creates all due entries not yet generated

### Entry Tracking

- Generated entries linked to source contract
- "Contract" badge displayed in entry tables
- Cannot edit contract-generated entries directly
- Deleting contract cascades to delete generated entries

---

## Entries

Core financial transaction management for income, expenses, and salaries.

### Entry Types

| Type | Description |
|------|-------------|
| Income | Money received (client payments, etc.) |
| Expense | Money paid out (non-employee costs) |
| Salary | Employee payments (linked to employee records) |

### Entry Fields

| Field | Description |
|-------|-------------|
| Type | Income or Expense |
| Category | Classification (Employee, Administration, Software, etc.) |
| Description | Brief description |
| Detail | Additional notes (optional) |
| Base Amount | Amount before taxes/fees |
| Total | Final amount including taxes/fees |
| Entry Date | Transaction date |
| Status | Completed or Pending |
| Currency | Transaction currency |

### Filtering Options

- **Date Range** - Start and end date
- **Category** - Multi-select categories
- **Employee** - Filter by linked employee
- **Amount Range** - Min and max amount
- **Status** - Completed/Pending/All
- **Currency** - Filter by currency

### Search

- Full-text search across entries
- Searches description and detail fields
- Real-time results as you type

### Bulk Operations

| Action | Description |
|--------|-------------|
| Mark Completed | Set selected entries to completed status |
| Mark Pending | Set selected entries to pending status |
| Delete Selected | Remove selected entries |

**Special Handling:**
- Contract-generated entries show warning before deletion
- Cannot individually edit contract-generated entries

### Export

- **CSV Export** - Download entries as CSV file
- Includes all visible columns
- Respects current filters
- Named with timestamp for organization

---

## Salary Calendar

Visual calendar view for managing employee salary payments.

### Calendar View

- Monthly calendar layout
- Color-coded payment indicators:
  - **Green** - Completed payments
  - **Yellow** - Pending payments
- Click any day to see payment details

### Weekly Summaries

Right sidebar showing:
- Week number
- Total payments per week
- Completed vs pending breakdown

### Daily Breakdown

Click any day to see:
- All payments scheduled for that day
- Employee names
- Payment amounts
- Payment status
- Edit/delete actions

### Payment Details Modal

- Full payment information
- Edit payment details
- Delete payment
- Mark as completed/pending

### Month Navigation

- Previous/Next month arrows
- "Today" button to return to current month
- Month and year display

### Auto-Generation

- System automatically generates salary entries for active employees
- Based on employee pay type and rate
- Monthly employees: Entry on 1st of month
- Weekly employees: Entry each Monday
- Can be manually triggered if needed

---

## Transaction Review

Interface for reviewing and classifying Wise bank transactions.

### Features

- View unmatched Wise transactions
- Classify transactions as income or expense
- Match transactions to employees
- Assign categories to transactions
- Bulk review capability

### Workflow

1. Import transactions from Wise (via CSV)
2. System identifies unmatched transactions
3. Review each transaction:
   - View transaction details
   - Select category
   - Match to employee (if salary)
   - Confirm classification
4. Transaction becomes regular entry

### Matching Options

- **Employee Match** - Link to employee as salary payment
- **Category Assignment** - Classify by expense category
- **Manual Entry** - Create custom entry from transaction

---

## Forecast View

End-of-month financial predictions and planning.

### Displayed Metrics

- **Current Balance** - Real-time balance from Wise
- **Forecasted Balance** - Predicted end-of-month balance
- **Weekly Payments Due** - Total weekly obligations remaining
- **Monthly Payments Due** - Total monthly obligations remaining
- **Days Remaining** - Days until end of month
- **Weeks Remaining** - Weeks until end of month

### Calculation Logic

```
Forecasted Balance = Current Balance
                   - (Weekly Payments x Weeks Remaining)
                   - Monthly Payments Due
                   + Expected Income
```

### Visual Indicators

- **Green** - Positive forecasted balance
- **Red** - Negative forecasted balance (warning)

### Breakdown View

- Weekly payment obligations itemized
- Monthly payment obligations itemized
- Expected income sources
- Net change forecast

---

## Wise Integration

Multi-currency balance tracking via Wise bank integration.

### Balance Display

- Individual balances per currency
- Real-time conversion to USD
- Exchange rates used for conversion
- Total USD equivalent

### Supported Currencies

- USD (US Dollar)
- EUR (Euro)
- PLN (Polish Zloty)
- Additional currencies as available

### CSV Import

Since direct API integration is under development, transactions are imported via CSV:

1. Export CSV from Wise.com:
   - Go to Account > Statements
   - Select date range
   - Download CSV
2. Import in application:
   - Dashboard > Import Transactions
   - Select CSV file
   - Review import preview
   - Confirm import

### Import Features

- Automatic duplicate detection (by Wise transaction ID)
- Transaction classification suggestions
- Import statistics (imported/skipped/errors)
- Error handling with detailed messages

### Balance Recalculation

- Manual recalculation trigger available
- Automatically recalculates on import
- Ensures balance accuracy across currencies

---

## Common Workflows

### Adding a New Employee

1. Navigate to **Employees** tab
2. Click **Add Employee** button
3. Fill in required fields (name, pay type, rate, start date)
4. Optionally add email, position, and project assignments
5. Click **Save**

### Recording a Client Payment

1. Navigate to **Income** tab
2. Click **Add Entry**
3. Set type to "Income"
4. Fill in client name, amount, date
5. Set status (Completed if received, Pending if expected)
6. Click **Add Entry**

### Terminating an Employee

1. Navigate to **Employees** tab
2. Select employee(s) to terminate
3. Click **Terminate** button
4. Set termination date
5. Review/adjust severance calculation
6. Choose whether to create severance entry
7. Confirm termination

### Creating a Recurring Contract

1. Navigate to **Contracts** tab
2. Click **Add Contract**
3. Enter client name and payment amount
4. Select contract type (Monthly/Yearly/One-time)
5. Set payment day and start date
6. Click **Save**
7. Click **Generate Entries** to create income entries

### Reviewing End-of-Month Forecast

1. Navigate to **Dashboard**
2. Click **View Forecast** or navigate to Forecast view
3. Review current balance vs forecasted balance
4. Check weekly and monthly payment obligations
5. Identify any potential shortfalls

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close modal/form |
| `Enter` | Submit form (when focused) |

---

## Tips and Best Practices

### Data Entry

- Use consistent category names for better filtering
- Add details for reference on large transactions
- Keep descriptions concise but informative

### Employee Management

- Set accurate pay rates and multipliers upfront
- Assign employees to projects for cost tracking
- Use termination workflow rather than deleting employees

### Financial Tracking

- Mark entries as "Completed" only when money has moved
- Use "Pending" for scheduled/expected transactions
- Regularly reconcile with Wise balance

### Contracts

- Set end dates for fixed-term contracts
- Use one-time contracts for single payments
- Review generated entries for accuracy

### Projects

- Create projects before assigning employees
- Use meaningful project names
- Archive completed projects rather than deleting
