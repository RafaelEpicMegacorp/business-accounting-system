# Quick Start Guide

Get the accounting app running in under 5 minutes!

## Prerequisites

- Docker Desktop installed
- Node.js v16+ installed (for local frontend development)

## Option 1: Docker (Fastest)

### 1. Clone/Create Project Structure

```bash
mkdir business-accounting
cd business-accounting
mkdir frontend backend backend/migrations backend/src
```

### 2. Create Configuration Files

Copy these files to your project:
- `docker-compose.yml` (from documentation)
- `backend/Dockerfile` (from documentation)
- `backend/migrations/001_initial_schema.sql` (from BACKEND_SETUP.md)

### 3. Create Backend Code

Copy all backend files from BACKEND_SETUP.md:
- `backend/src/config/database.js`
- `backend/src/models/entryModel.js`
- `backend/src/controllers/entryController.js`
- `backend/src/routes/entryRoutes.js`
- `backend/src/server.js`
- `backend/package.json`

### 4. Create Backend package.json

```json
{
  "name": "accounting-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 5. Start Services

```bash
docker-compose up -d
```

Wait 30 seconds for services to start. Check status:

```bash
docker-compose ps
```

### 6. Setup Frontend

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install lucide-react axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 7. Configure Frontend

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:3001/api
```

Copy files from FRONTEND_API_INTEGRATION.md:
- `src/services/api.js`
- `src/services/entryService.js`
- `src/components/AccountingApp.jsx`

Update `src/App.jsx`:
```jsx
import AccountingApp from './components/AccountingApp'

function App() {
  return <AccountingApp />
}

export default App
```

Configure Tailwind in `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 8. Start Frontend

```bash
npm run dev
```

### 9. Open Browser

Visit: http://localhost:5173

Done! 🎉

## Option 2: Manual Setup (More Control)

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu:**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

```bash
psql postgres
CREATE USER accounting_user WITH PASSWORD 'accounting_pass';
CREATE DATABASE accounting_db OWNER accounting_user;
GRANT ALL PRIVILEGES ON DATABASE accounting_db TO accounting_user;
\q
```

### 3. Setup Backend

```bash
mkdir -p backend/src/{config,models,controllers,routes} backend/migrations
cd backend

# Create package.json
npm init -y

# Install dependencies
npm install express pg dotenv cors
npm install -D nodemon
```

Copy all backend files from BACKEND_SETUP.md.

Create `backend/.env`:
```
DATABASE_URL=postgresql://accounting_user:accounting_pass@localhost:5432/accounting_db
PORT=3001
NODE_ENV=development
```

Run migration:
```bash
psql -U accounting_user -d accounting_db -f migrations/001_initial_schema.sql
```

Start backend:
```bash
npm run dev
```

### 4. Setup Frontend

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install lucide-react axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Follow steps 7-9 from Option 1.

## Verify Installation

### Test Backend

```bash
# Health check
curl http://localhost:3001/health

# Get entries
curl http://localhost:3001/api/entries

# Should return array of entries
```

### Test Frontend

1. Open http://localhost:5173
2. Click "Add Entry"
3. Fill in form and submit
4. Verify entry appears in table
5. Refresh page - entry should persist

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `docker-compose ps` or `pg_isready`
- Check .env file exists and has correct credentials
- Check migrations ran successfully: `psql -U accounting_user -d accounting_db -c "\dt"`

### Frontend can't connect to backend
- Verify backend is running on port 3001
- Check VITE_API_URL in frontend/.env
- Check browser console for CORS errors
- Verify backend has `cors()` middleware

### Database connection error
- Check DATABASE_URL format: `postgresql://user:pass@host:port/dbname`
- Verify PostgreSQL is accepting connections
- Check user has proper permissions

### Port already in use
```bash
# Find process using port
lsof -i :3001  # or :5173

# Kill process
kill -9 <PID>
```

## Next Steps

1. Read through FEATURES_ROADMAP.md for feature ideas
2. Check BACKEND_SETUP.md for detailed backend docs
3. Check FRONTEND_API_INTEGRATION.md for API details
4. Use CLAUDE_CODE.md for development guidance

## Quick Commands

```bash
# Start everything (Docker)
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f

# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev

# Database backup
docker exec accounting_db pg_dump -U accounting_user accounting_db > backup.sql

# Database restore
docker exec -i accounting_db psql -U accounting_user accounting_db < backup.sql
```

## File Checklist

Before starting, ensure you have:
- [ ] docker-compose.yml
- [ ] backend/Dockerfile
- [ ] backend/package.json
- [ ] backend/.env
- [ ] backend/migrations/001_initial_schema.sql
- [ ] backend/src/server.js
- [ ] backend/src/config/database.js
- [ ] backend/src/models/entryModel.js
- [ ] backend/src/controllers/entryController.js
- [ ] backend/src/routes/entryRoutes.js
- [ ] frontend/.env
- [ ] frontend/src/services/api.js
- [ ] frontend/src/services/entryService.js
- [ ] frontend/src/components/AccountingApp.jsx

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Review detailed setup in SETUP.md
3. Verify all files are in place
4. Check Docker/PostgreSQL logs