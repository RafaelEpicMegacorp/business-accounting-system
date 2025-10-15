# Business Accounting App - Setup Instructions

## Date Tracking Implementation Status
✅ **FULLY IMPLEMENTED** - Date tracking is built into the application from the start.

### Features:
- Date input field in entry form (HTML5 date picker)
- Default date: Today's date
- Date column in entries table
- Entries sorted by date (most recent first)
- Date persistence in PostgreSQL database
- Date format: Display using `toLocaleDateString()`

## Quick Start (5 minutes)

### Prerequisites
- Docker Desktop installed and running
- Node.js v16+ installed
- Git (optional)

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Start PostgreSQL with Docker
```bash
# From project root
docker-compose up -d postgres
```

Wait 30 seconds for PostgreSQL to initialize, then run the migration:

```bash
# Run database migration
docker exec -i accounting_db psql -U accounting_user -d accounting_db < backend/migrations/001_initial_schema.sql
```

### Step 3: Start Backend API
```bash
cd backend
npm run dev
```

The backend will start on http://localhost:3001

### Step 4: Install Frontend Dependencies
Open a new terminal:
```bash
cd frontend
npm install
```

### Step 5: Start Frontend
```bash
npm run dev
```

The frontend will start on http://localhost:5173

### Step 6: Open Browser
Visit http://localhost:5173

✅ Done! Your accounting app with date tracking is ready!

## Testing Date Tracking

### Test 1: Create Entry with Default Date
1. Click "Add Entry"
2. Notice the date field is pre-filled with today's date
3. Fill in other fields (Description: "Test Entry", Base Amount: 100, Total: 100)
4. Click "Add Entry"
5. ✅ Verify entry appears in table with today's date

### Test 2: Create Entry with Custom Date
1. Click "Add Entry"
2. Change the date to a past date (e.g., last month)
3. Fill in entry details
4. Click "Add Entry"
5. ✅ Verify entry appears with the custom date

### Test 3: Edit Entry Date
1. Click edit icon (✏️) on any entry
2. Change the date to a different date
3. Click "Update Entry"
4. ✅ Verify the date updated in the table

### Test 4: Date Sorting
1. Create several entries with different dates
2. ✅ Verify entries are sorted by date (most recent first)

### Test 5: Date Persistence
1. Create an entry with a specific date
2. Refresh the page (F5)
3. ✅ Verify the entry still shows with the correct date

## Project Structure

```
accounting/
├── backend/
│   ├── src/
│   │   ├── config/database.js          # PostgreSQL connection
│   │   ├── models/entryModel.js        # Date handling in queries
│   │   ├── controllers/entryController.js
│   │   ├── routes/entryRoutes.js
│   │   └── server.js
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Schema with entry_date column
│   ├── .env
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── AccountingApp.jsx       # Date picker & display
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── entryService.js         # Date support in API calls
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env
│   ├── package.json
│   └── vite.config.js
└── docker-compose.yml
```

## API Endpoints

All endpoints support the `entryDate` field:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | Get all entries (sorted by date DESC) |
| GET | `/api/entries/:id` | Get single entry |
| POST | `/api/entries` | Create new entry (with date) |
| PUT | `/api/entries/:id` | Update entry (including date) |
| DELETE | `/api/entries/:id` | Delete entry |
| GET | `/api/entries/totals` | Get income/expense totals |
| GET | `/health` | Health check |

### Example POST Request with Date:
```bash
curl -X POST http://localhost:3001/api/entries \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "category": "Software",
    "description": "GitHub Pro",
    "detail": "Monthly subscription",
    "baseAmount": 100,
    "total": 112,
    "entryDate": "2025-10-13"
  }'
```

## Database Schema (with Date Column)

```sql
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    detail TEXT,
    base_amount DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- ✅ DATE TRACKING
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast date-based queries
CREATE INDEX idx_entries_date ON entries(entry_date);
```

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

## Troubleshooting

### PostgreSQL Connection Error
- Verify Docker is running: `docker ps`
- Check PostgreSQL is healthy: `docker-compose ps`
- Verify connection: `docker exec -it accounting_db psql -U accounting_user -d accounting_db`

### Backend Won't Start
- Check .env file exists in backend/
- Verify PostgreSQL is running
- Check port 3001 is not in use: `lsof -i :3001`

### Frontend Can't Connect
- Verify backend is running on http://localhost:3001
- Check .env file exists in frontend/
- Check browser console for CORS errors

### Migration Failed
```bash
# Manually run migration
docker exec -i accounting_db psql -U accounting_user -d accounting_db < backend/migrations/001_initial_schema.sql

# Verify table exists
docker exec -it accounting_db psql -U accounting_user -d accounting_db -c "\d entries"
```

### Date Not Saving
- Check browser console for errors
- Verify date format is YYYY-MM-DD
- Check backend logs for SQL errors
- Test API directly with curl

## Development Commands

```bash
# Start PostgreSQL only
docker-compose up -d postgres

# Stop all Docker services
docker-compose down

# View logs
docker-compose logs -f postgres
docker-compose logs -f backend

# Backend development
cd backend
npm run dev

# Frontend development
cd frontend
npm run dev

# Build frontend for production
cd frontend
npm run build

# Database backup
docker exec accounting_db pg_dump -U accounting_user accounting_db > backup.sql

# Database restore
docker exec -i accounting_db psql -U accounting_user accounting_db < backup.sql
```

## Next Features to Implement

See `FEATURES_ROADMAP.md` for complete list. Quick wins:

1. ✅ **Date tracking** (COMPLETED)
2. Search/filter by date range
3. Export to CSV (with dates)
4. Charts by date
5. Budget tracking

## Support

For issues or questions:
1. Check this setup guide
2. Review `CLAUDE_CODE.md` for development guidelines
3. Check logs: `docker-compose logs -f`
4. Verify database: `docker exec -it accounting_db psql -U accounting_user -d accounting_db`
