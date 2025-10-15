# Development Setup

## Prerequisites

- **Node.js**: v16+ (recommended: v18 or v20)
- **PostgreSQL**: v14+ (or Docker)
- **npm** or **yarn**: Package manager
- **Git**: Version control

## Project Structure

```
business-accounting/
├── backend/          # Node.js + Express API
├── frontend/         # React application
└── docker-compose.yml
```

## Quick Start with Docker (Recommended)

### 1. Create Project Structure

```bash
mkdir business-accounting
cd business-accounting
mkdir frontend backend
```

### 2. Setup Docker Compose

See `BACKEND_SETUP.md` for complete Docker configuration.

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

## Manual Setup

### Backend Setup

#### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

#### 2. Create Database

```bash
psql postgres
CREATE USER accounting_user WITH PASSWORD 'accounting_pass';
CREATE DATABASE accounting_db OWNER accounting_user;
GRANT ALL PRIVILEGES ON DATABASE accounting_db TO accounting_user;
\q
```

#### 3. Initialize Backend

```bash
cd backend
npm init -y
npm install express pg dotenv cors
npm install -D nodemon
```

#### 4. Create .env File

```bash
DATABASE_URL=postgresql://accounting_user:accounting_pass@localhost:5432/accounting_db
PORT=3001
NODE_ENV=development
```

#### 5. Run Migrations

```bash
psql -U accounting_user -d accounting_db -f migrations/001_initial_schema.sql
```

#### 6. Start Backend

```bash
npm run dev
```

Backend runs on http://localhost:3001

### Frontend Setup

#### 1. Create React App with Vite

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install lucide-react axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

#### 2. Configure Tailwind CSS

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### 3. Create Environment File

**frontend/.env:**
```bash
VITE_API_URL=http://localhost:3001/api
```

#### 4. Setup Project Structure

```bash
mkdir -p src/components src/services
```

Copy files from documentation:
- `src/components/AccountingApp.jsx` from `FRONTEND_API_INTEGRATION.md`
- `src/services/api.js` from `FRONTEND_API_INTEGRATION.md`
- `src/services/entryService.js` from `FRONTEND_API_INTEGRATION.md`

#### 5. Update App.jsx

```jsx
import AccountingApp from './components/AccountingApp'

function App() {
  return <AccountingApp />
}

export default App
```

#### 6. Start Frontend

```bash
npm run dev
```

Frontend runs on http://localhost:5173

## File Structure After Setup

```
business-accounting/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   └── entryController.js
│   │   ├── models/
│   │   │   └── entryModel.js
│   │   ├── routes/
│   │   │   └── entryRoutes.js
│   │   └── server.js
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── AccountingApp.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── entryService.js
│   │   ├── App.jsx
│   │   ├── index.jsx
│   │   └── index.css
│   ├── .env
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
└── docker-compose.yml
```

## Testing the Setup

### 1. Test Backend API

```bash
# Health check
curl http://localhost:3001/health

# Get all entries
curl http://localhost:3001/api/entries

# Get totals
curl http://localhost:3001/api/entries/totals
```

### 2. Test Frontend

1. Open http://localhost:5173
2. Try adding a new entry
3. Edit an existing entry
4. Delete an entry
5. Verify data persists after page refresh

## Development Commands

### Backend
```bash
cd backend
npm run dev      # Start with nodemon (auto-reload)
npm start        # Start in production mode
```

### Frontend (Vite)
```bash
cd frontend
npm run dev      # Start dev server (localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build
```

## Environment Variables

### Backend (.env)
```bash
DATABASE_URL=postgresql://accounting_user:accounting_pass@localhost:5432/accounting_db
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001/api
```

### Production
```bash
# Backend
DATABASE_URL=your_production_database_url
NODE_ENV=production

# Frontend
VITE_API_URL=https://your-api-domain.com/api
```

## Troubleshooting

### Tailwind styles not applying
1. Verify `tailwind.config.js` content paths are correct
2. Ensure `@tailwind` directives are in `index.css`
3. Restart dev server

### Module not found: 'lucide-react'
```bash
npm install lucide-react
```

### Port already in use
```bash
# Vite: Change port in vite.config.js
export default defineConfig({
  server: { port: 5174 }
})

# CRA: Use different port
PORT=3001 npm start
```

## VS Code Extensions (Recommended)

- **ES7+ React/Redux/React-Native snippets**: Quick component generation
- **Tailwind CSS IntelliSense**: Autocomplete for Tailwind classes
- **Prettier**: Code formatting
- **ESLint**: Code linting

## Git Workflow

```bash
# Initialize repository
git init

# Create .gitignore
echo "node_modules/
dist/
.env
.DS_Store" > .gitignore

# Initial commit
git add .
git commit -m "Initial commit: Accounting app setup"

# Create feature branch
git checkout -b feature/date-tracking

# After changes
git add .
git commit -m "Add date tracking feature"
git checkout main
git merge feature/date-tracking
```

## Production Build

```bash
# Build optimized production files
npm run build

# Test production build locally
npm run preview  # Vite
# or
npx serve -s build  # CRA
```

## Deployment Options

### Vercel (Recommended)
```bash
npm install -g vercel
vercel login
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### GitHub Pages (CRA)
```bash
# Add to package.json
"homepage": "https://yourusername.github.io/business-accounting"

npm install --save-dev gh-pages

# Add scripts
"predeploy": "npm run build",
"deploy": "gh-pages -d build"

npm run deploy
```

## Next Steps

1. Complete setup following steps above
2. Run the app locally
3. Start implementing Phase 1 features (see `FEATURES_ROADMAP.md`)
4. Set up version control with Git
5. Consider backend integration for data persistence

## Getting Help

- **React Documentation**: https://react.dev
- **Tailwind CSS Docs**: https://tailwindcss.com/docs
- **Vite Guide**: https://vitejs.dev/guide
- **Lucide Icons**: https://lucide.dev