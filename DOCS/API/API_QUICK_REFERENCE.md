# API Quick Reference

Fast lookup table for all API endpoints (internal and Wise).

---

## Internal API Endpoints

**Base URL**: `http://localhost:3001` (dev) | `https://business-accounting-system-production.up.railway.app` (prod)

### Authentication (3 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | Public | Login with username/password |
| GET | `/api/auth/me` | Required | Get current user info |
| POST | `/api/auth/logout` | Required | Logout current user |

### Entries (15 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | Get all entries (filterable) |
| GET | `/api/entries/:id` | Get single entry |
| POST | `/api/entries` | Create new entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry |
| DELETE | `/api/entries/bulk` | Bulk delete entries |
| PUT | `/api/entries/bulk/status` | Bulk update status |
| GET | `/api/entries/totals` | Get financial totals |
| GET | `/api/entries/income` | Get income entries only |
| GET | `/api/entries/expenses` | Get expense entries only |
| GET | `/api/entries/salaries` | Get salary entries only |
| GET | `/api/entries/scheduled` | Get pending entries |
| GET | `/api/entries/forecast` | Get forecast data |
| POST | `/api/entries/generate-salary-entries` | Auto-generate salaries |
| POST | `/api/entries/cleanup-weekly` | Clean up incorrect entries |

### Employees (12 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all employees |
| GET | `/api/employees/active` | Get active employees |
| GET | `/api/employees/:id` | Get single employee |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Delete employee (hard) |
| POST | `/api/employees/:id/terminate` | Terminate employee |
| POST | `/api/employees/:id/reactivate` | Reactivate employee |
| POST | `/api/employees/:id/calculate-severance` | Calculate severance |
| DELETE | `/api/employees/bulk` | Bulk delete |
| POST | `/api/employees/bulk/terminate` | Bulk terminate |
| POST | `/api/employees/bulk/reactivate` | Bulk reactivate |

### Contracts (8 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts` | Get all contracts |
| GET | `/api/contracts/active` | Get active contracts |
| GET | `/api/contracts/:id` | Get single contract |
| POST | `/api/contracts` | Create contract |
| PUT | `/api/contracts/:id` | Update contract |
| DELETE | `/api/contracts/:id` | Delete contract |
| POST | `/api/contracts/:id/generate-entries` | Generate income entries |
| GET | `/api/contracts/stats/revenue` | Get revenue stats |

### Dashboard (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/api/dashboard/chart-data` | Get chart data |
| GET | `/api/dashboard/category-breakdown` | Get category breakdown |

### Currency (7 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/currency/balances` | Get all currency balances |
| GET | `/api/currency/balances/:currency` | Get specific currency |
| GET | `/api/currency/summary` | Get balance summary |
| GET | `/api/currency/total-usd` | Get total in USD |
| GET | `/api/currency/exchanges` | Get exchange history |
| GET | `/api/currency/entries/:currency` | Get entries by currency |
| POST | `/api/currency/recalculate` | Recalculate balances |

### Wise Import (2 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wise/import` | Upload and import CSV |
| GET | `/api/wise/test-connection` | Test database connection |

### System (1 endpoint)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Health check |

**Total Internal Endpoints**: 51

---

## Wise API Endpoints

**Base URL**: `https://api.sandbox.transferwise.tech` (sandbox) | `https://api.transferwise.com` (prod)

### Profile (1 endpoint)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v2/profiles` | Get user profiles |

### Balance (10 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v4/profiles/{profileId}/balances` | List balances |
| GET | `/v4/profiles/{profileId}/balances/{balanceId}` | Get balance by ID |
| POST | `/v4/profiles/{profileId}/balances` | Create balance account |
| DELETE | `/v4/profiles/{profileId}/balances/{balanceId}` | Delete balance |
| POST | `/v2/profiles/{profileId}/balance-movements` | Convert/move money |
| GET | `/v1/profiles/{profileId}/balance-capacity` | Get deposit limits |
| GET | `/v1/profiles/{profileId}/total-funds/{currency}` | Get total funds |

### Balance Statement (1 endpoint)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/profiles/{profileId}/balance-statements/{balanceId}/statement.{format}` | Get transaction history |

**Formats**: `.json`, `.csv`, `.pdf`, `.xlsx`, `.xml`, `.mt940`, `.qif`

### Webhooks (9 endpoints)

#### Application-Level Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v3/applications/{clientKey}/subscriptions` | Create subscription |
| GET | `/v3/applications/{clientKey}/subscriptions` | List subscriptions |
| GET | `/v3/applications/{clientKey}/subscriptions/{id}` | Get subscription |
| DELETE | `/v3/applications/{clientKey}/subscriptions/{id}` | Delete subscription |
| POST | `/v3/applications/{clientKey}/subscriptions/{id}/test-notifications` | Test webhook |

#### Profile-Level Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v3/profiles/{profileId}/subscriptions` | Create subscription |
| GET | `/v3/profiles/{profileId}/subscriptions` | List subscriptions |
| GET | `/v3/profiles/{profileId}/subscriptions/{id}` | Get subscription |
| DELETE | `/v3/profiles/{profileId}/subscriptions/{id}` | Delete subscription |

**Total Wise Endpoints Documented**: 21

---

## Common Request Headers

### Internal API

```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Wise API

```http
Authorization: Bearer <wise-api-token>
Content-Type: application/json
X-idempotence-uuid: <uuid>  # Required for POST requests
```

---

## Response Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 200 | OK | Successful GET/PUT request |
| 201 | Created | Successful POST request |
| 204 | No Content | Successful DELETE request |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Internal server error |

---

## Entry Categories

### Income Categories
- `consulting` - Consulting services
- `contract` - Contract work
- `other_income` - Other income
- `bank_transfer` - Money added

### Expense Categories
- `salaries` - Employee salaries
- `contractor_payments` - Contractor payments
- `office_supplies` - Office supplies
- `software_subscriptions` - Software subscriptions
- `marketing` - Marketing expenses
- `travel` - Travel expenses
- `meals_entertainment` - Meals and entertainment
- `other_expenses` - Other expenses

---

## Employee Pay Types

| Pay Type | Description | Calculation |
|----------|-------------|-------------|
| `monthly` | Monthly salary | pay_rate × pay_multiplier |
| `weekly` | Weekly salary | (pay_rate ÷ 4) × pay_multiplier |
| `hourly` | Hourly rate | pay_rate × hours × pay_multiplier |

**Note**: `pay_rate` for weekly employees is MONTHLY salary (divided by 4 for weekly amount).

---

## Contract Types

| Type | Description | Payment Schedule |
|------|-------------|------------------|
| `monthly` | Recurring monthly | Every month on payment_day |
| `yearly` | Recurring yearly | Every year on payment_day |
| `one-time` | Single payment | Once only |

---

## Wise Transaction Types

| Type | Description |
|------|-------------|
| `DEPOSIT` | Incoming bank transfer |
| `TRANSFER` | Outgoing transfer |
| `CONVERSION` | Currency exchange |
| `CARD` | Card payment |
| `MONEY_ADDED` | Manual top-up |
| `INCOMING_CROSS_BALANCE` | Internal transfer in |
| `OUTGOING_CROSS_BALANCE` | Internal transfer out |
| `BALANCE_INTEREST` | Interest earned |
| `BALANCE_ADJUSTMENT` | Account adjustment |

---

## Wise Event Types

| Event | Description | Use Case |
|-------|-------------|----------|
| `balances#credit` | Money received | Auto-import incoming transactions |
| `balances#update` | Balance changed | Sync balance updates |
| `transfers#state-change` | Transfer status changed | Track outgoing transfers |
| `transfers#active-cases` | Transfer has issues | Handle transfer problems |

**Full Event List**: https://docs.wise.com/api-docs/webhooks-notifications/event-types

---

## Currency Codes

Supported multi-currency balances:

| Code | Currency |
|------|----------|
| USD | US Dollar |
| EUR | Euro |
| GBP | British Pound |
| PLN | Polish Złoty |

---

## Query Parameter Patterns

### Date Ranges
```
?startDate=2025-01-01&endDate=2025-01-31
```

### Filtering
```
?type=income&category=consulting&status=completed
```

### Pagination (not implemented yet)
```
?page=1&limit=50
```

---

## Common API Patterns

### Create Entry
```bash
curl -X POST http://localhost:3001/api/entries \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "category": "office_supplies",
    "description": "Office chairs",
    "total": 1500.00,
    "entry_date": "2025-01-20"
  }'
```

### Get Dashboard Stats
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/dashboard/stats
```

### Import Wise CSV
```bash
curl -X POST http://localhost:3001/api/wise/import \
  -H "Authorization: Bearer <token>" \
  -F "csvFile=@wise_statement.csv"
```

### Get Wise Balance Statement
```bash
curl -H "Authorization: Bearer <wise-token>" \
  "https://api.transferwise.com/v1/profiles/12345678/balance-statements/200001/statement.json?currency=EUR&intervalStart=2025-01-01T00:00:00.000Z&intervalEnd=2025-01-31T23:59:59.999Z&type=COMPACT"
```

### Create Wise Webhook
```bash
curl -X POST "https://api.transferwise.com/v3/profiles/12345678/subscriptions" \
  -H "Authorization: Bearer <wise-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Transaction Sync",
    "trigger_on": "balances#credit",
    "delivery": {
      "version": "2.0.0",
      "url": "https://your-server.com/webhook/wise"
    }
  }'
```

---

## Environment Variables

### Backend (.env)
```bash
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=accounting_db
DB_USER=accounting_user
DB_PASSWORD=accounting_pass
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:7392
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001
VITE_PORT=7392
```

---

## Rate Limits

### Internal API
- **Current**: No rate limiting implemented
- **Recommended**: Implement in production

### Wise API
- **Limit**: 100 requests/minute per token
- **Headers**: `X-RateLimit-*` headers included
- **Strategy**: Exponential backoff on 429 errors

---

## Authentication Tokens

### Internal API (JWT)
```
Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Expires: Configurable (default: 24 hours)
Refresh: Use /api/auth/login to get new token
```

### Wise API Token
```
Format: API key from Wise dashboard
Expires: Does not expire (rotate manually)
Permissions: Read balances, statements, webhooks
```

---

## Testing

### Internal API Test User
```
Username: rafael
Password: asdflkj@3!
```

### Wise Sandbox
```
URL: https://sandbox.transferwise.tech
Sign up: Required for API token
Free: Yes, no real money
```

---

## File Uploads

### Wise CSV Import
```
Endpoint: POST /api/wise/import
Content-Type: multipart/form-data
Field Name: csvFile
Max Size: 10MB
Format: Wise 21-column CSV export
```

---

## Database Pool

### Connection Limits
```javascript
{
  max: 5,                     // Max connections
  idleTimeoutMillis: 30000,   // 30 seconds
  connectionTimeoutMillis: 10000  // 10 seconds
}
```

**Why**: Prevents connection exhaustion on Railway free tier.

---

## Useful SQL Queries

### Get Total Balance
```sql
SELECT
  SUM(CASE WHEN type = 'income' THEN total ELSE 0 END) as total_income,
  SUM(CASE WHEN type = 'expense' THEN total ELSE 0 END) as total_expenses,
  SUM(CASE WHEN type = 'income' THEN total ELSE -total END) as balance
FROM entries;
```

### Get Employee Payment Summary
```sql
SELECT
  e.name,
  COUNT(en.id) as payment_count,
  SUM(en.total) as total_paid
FROM employees e
LEFT JOIN entries en ON en.employee_id = e.id
WHERE e.is_active = true
GROUP BY e.id, e.name;
```

### Get Monthly Revenue
```sql
SELECT
  DATE_TRUNC('month', entry_date) as month,
  SUM(total) as revenue
FROM entries
WHERE type = 'income'
GROUP BY month
ORDER BY month DESC;
```

---

## Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution**: Check JWT token is valid and included in Authorization header

### Issue: CORS Error
**Solution**: Add frontend URL to CORS_ORIGINS in backend .env

### Issue: Database Connection Failed
**Solution**: Check database is running and connection pool not exhausted

### Issue: Wise CSV Import Fails
**Solution**: Verify 21-column format and database connection

### Issue: Salary Entries on Wrong Day
**Solution**: Run POST /api/entries/cleanup-weekly, then regenerate

---

## Quick Links

- **Internal API Full Docs**: [INTERNAL_API.md](INTERNAL_API.md)
- **Wise API Full Docs**: [WISE_API_REFERENCE.md](WISE_API_REFERENCE.md)
- **Official Wise Docs**: https://docs.wise.com/api-docs/api-reference/
- **Main Documentation**: [../README.md](../README.md)

---

**Last Updated:** 2025-10-27
**Version:** 1.0
