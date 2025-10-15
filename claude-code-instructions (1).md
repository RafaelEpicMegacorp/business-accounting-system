# Claude Code Instructions

This file contains specific instructions for working with Claude Code on this accounting application project.

## Project Context

You are working on a **Business Accounting Application** - a full-stack application for tracking business income and expenses with:
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Database**: PostgreSQL with proper schema and migrations

## Current State

- Full-stack application with separate frontend and backend
- PostgreSQL database for persistent storage
- RESTful API with Express
- React frontend consuming the API
- Basic CRUD operations for financial entries
- Summary dashboard with totals
- Date tracking for entries

## Key Files

- **README.md**: Project overview and quick start
- **BACKEND_SETUP.md**: Complete backend and PostgreSQL setup
- **FRONTEND_API_INTEGRATION.md**: API service and integration code
- **COMPONENT.md**: Original frontend component code (now with API calls)
- **STRUCTURE.md**: File organization and data models
- **FEATURES_ROADMAP.md**: Prioritized list of future features
- **SETUP.md**: Complete development environment setup

## Architecture

```
Frontend (React)
    ↓ HTTP Requests
Backend API (Express)
    ↓ SQL Queries
PostgreSQL Database
```

## Database Schema

```sql
entries (
  id SERIAL PRIMARY KEY,
  type VARCHAR(10),           -- 'income' or 'expense'
  category VARCHAR(50),
  description VARCHAR(255),
  detail TEXT,
  base_amount DECIMAL(12,2),
  total DECIMAL(12,2),
  entry_date DATE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Common Tasks

### Task 1: Add New API Endpoint
```
Add endpoint for filtering entries by date range:

Backend:
1. Add method in entryModel.js for date range query
2. Add controller method in entryController.js
3. Add route in entryRoutes.js
4. Test with curl

Frontend:
5. Add method in entryService.js
6. Use in component with date picker inputs
```

### Task 2: Add Search Functionality
```
Allow users to search entries:

Backend:
1. Add search method in entryModel.js with ILIKE query
2. Add controller method with query params
3. Add route with query string support

Frontend:
4. Add search input field above table
5. Call API with search parameter
6. Debounce search input for performance
```

### Task 3: Add Export to CSV
```
Download entries as CSV file:

Backend (optional):
1. Create export endpoint that returns CSV format
2. Add Content-Type: text/csv header

Frontend:
3. Create exportToCSV function
4. Fetch data and format as CSV string
5. Trigger download with proper filename
```

### Task 4: Add Charts
```
Visualize spending by category:

Backend:
1. Add aggregation query in entryModel.js
2. Create endpoint for chart data (grouped by category)

Frontend:
3. Install recharts: npm install recharts
4. Create chart component
5. Fetch aggregated data from API
6. Display pie/bar charts
```

### Task 5: Add Authentication
```
Secure the application with JWT:

Backend:
1. Install: npm install jsonwebtoken bcrypt
2. Create users table migration
3. Create auth routes (register, login)
4. Add JWT middleware
5. Protect entry routes with auth middleware

Frontend:
6. Create login/register pages
7. Store JWT in localStorage
8. Add Authorization header to API calls
9. Add route protection
```

### Task 6: Add Pagination
```
Handle large datasets efficiently:

Backend:
1. Add LIMIT and OFFSET to SQL queries
2. Add page and limit query params
3. Return total count and page info

Frontend:
4. Add pagination controls
5. Track current page in state
6. Call API with page parameter
```

## Code Style Guidelines

- Use functional components with hooks
- Keep components focused and single-purpose
- Use descriptive variable names
- Add comments for complex logic
- Use Tailwind utility classes (core only)
- Follow existing code patterns

## Important Constraints

### Frontend
- **No HTML forms**: Use divs with onClick handlers instead of form/onSubmit in React artifacts
- **Tailwind core classes only**: No custom Tailwind configs
- **Axios for API calls**: Always use the entryService abstraction

### Backend
- **Use parameterized queries**: Always use $1, $2 placeholders in SQL to prevent injection
- **Async/await**: All database operations must use async/await
- **Error handling**: Wrap all routes in try-catch blocks
- **Input validation**: Validate all user inputs before database operations

### Database
- **Use migrations**: Never manually modify the database schema
- **Foreign keys**: Plan for future user_id foreign key
- **Indexes**: Add indexes for frequently queried columns
- **Timestamps**: Use created_at and updated_at for all tables

## Data Model Reference

### Database Schema
```sql
entries (
  id SERIAL PRIMARY KEY,
  type VARCHAR(10) CHECK (type IN ('income', 'expense')),
  category VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL,
  detail TEXT,
  base_amount DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
```

### JavaScript Entry Object (Frontend)
```javascript
{
  id: number,
  type: 'income' | 'expense',
  category: string,
  description: string,
  detail: string,
  baseAmount: number,    // camelCase in JS
  total: number,
  entryDate: string,     // ISO date string
}
```

### PostgreSQL Entry Object (Backend)
```javascript
{
  id: number,
  type: string,
  category: string,
  description: string,
  detail: string,
  base_amount: number,   // snake_case from DB
  total: number,
  entry_date: string,
  created_at: string,
  updated_at: string
}
```

## Testing Checklist

### Backend Tests
- [ ] API endpoints return correct status codes
- [ ] Database queries use parameterized statements
- [ ] Error responses include proper messages
- [ ] CORS headers allow frontend origin
- [ ] Migrations run successfully

### Frontend Tests
- [ ] Add new entry works correctly
- [ ] Edit existing entry preserves data
- [ ] Delete entry shows confirmation
- [ ] Calculations (totals) update correctly
- [ ] API errors display user-friendly messages
- [ ] Loading states show during API calls
- [ ] UI is responsive (mobile/desktop)
- [ ] No console errors

### Integration Tests
- [ ] Data persists after page refresh
- [ ] Backend and frontend communicate correctly
- [ ] Database constraints are enforced
- [ ] Dates are formatted correctly

## Future Considerations

When expanding beyond Phase 1:
- Consider splitting into multiple components
- Create custom hooks for state management
- Add PropTypes or TypeScript
- Set up proper testing (Jest, React Testing Library)
- Implement backend API for multi-user support

## Development Workflow

### For Backend Changes
1. Write/update database migration if schema changes
2. Update model layer (entryModel.js)
3. Update controller layer (entryController.js)
4. Update routes if needed (entryRoutes.js)
5. Test with curl or Postman
6. Update API documentation

### For Frontend Changes
1. Update service layer if API changes (entryService.js)
2. Update component logic
3. Test in browser
4. Verify API calls in Network tab

### For Full-Stack Features
1. Plan database schema changes
2. Write backend migration
3. Implement backend API endpoint
4. Test backend with curl
5. Implement frontend service method
6. Update frontend component
7. Test end-to-end

## Priority Order for Claude Code

Recommended order for implementing features:

**Phase 1 - Core Enhancements (Week 1-2)**
1. ✅ PostgreSQL backend (COMPLETED)
2. ✅ Date tracking (COMPLETED)
3. Search/filter by text and date range
4. Input validation on backend
5. Better error handling and messages

**Phase 2 - User Experience (Week 3-4)**
6. Export to CSV functionality
7. Charts and visualizations (by category, over time)
8. Pagination for large datasets
9. Sort by different columns
10. Budget tracking per category

**Phase 3 - Advanced Features (Month 2)**
11. User authentication (JWT)
12. Multi-user support with user_id foreign key
13. Recurring entries
14. File attachments (receipts)
15. Email notifications

**Phase 4 - Production Ready (Month 3+)**
16. Audit logging
17. Backup and restore
18. API rate limiting
19. Comprehensive testing
20. Deployment configuration

## Useful Commands for Development

### Database Commands
```bash
# Connect to database
psql -U accounting_user -d accounting_db

# Run migration
psql -U accounting_user -d accounting_db -f migrations/002_new_migration.sql

# Backup database
pg_dump -U accounting_user accounting_db > backup.sql

# Restore database
psql -U accounting_user -d accounting_db < backup.sql

# View tables
\dt

# Describe table
\d entries

# Query entries
SELECT * FROM entries ORDER BY entry_date DESC LIMIT 10;
```

### Backend Commands
```bash
cd backend

# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Production
npm start

# Test API endpoint
curl http://localhost:3001/api/entries
curl -X POST http://localhost:3001/api/entries \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","category":"Software","description":"Test","baseAmount":100,"total":100}'
```

### Frontend Commands
```bash
cd frontend

# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check for linting errors
npm run lint
```

### Docker Commands
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Restart service
docker-compose restart backend

# Execute command in container
docker exec -it accounting_db psql -U accounting_user -d accounting_db
```

## Common SQL Queries

```sql
-- Get total by category
SELECT category, SUM(total) as total
FROM entries
WHERE type = 'expense'
GROUP BY category
ORDER BY total DESC;

-- Get entries for a date range
SELECT * FROM entries
WHERE entry_date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY entry_date DESC;

-- Get monthly summary
SELECT 
  DATE_TRUNC('month', entry_date) as month,
  type,
  SUM(total) as total
FROM entries
GROUP BY month, type
ORDER BY month DESC;

-- Search entries
SELECT * FROM entries
WHERE description ILIKE '%salary%'
   OR detail ILIKE '%salary%';
```

## Notes for Claude Code

- **Backend first**: When adding features, implement backend API first, then frontend
- **Test incrementally**: Test each layer (database, backend, frontend) separately
- **Use parameterized queries**: Always use $1, $2 in SQL to prevent injection
- **Handle errors properly**: Both backend (try-catch) and frontend (error states)
- **Keep it simple**: Start with basic implementation, refactor later
- **Document API changes**: Update this file when adding new endpoints
- **Migration files**: Never modify existing migrations, create new ones
- **Environment variables**: Keep sensitive data in .env, never commit it