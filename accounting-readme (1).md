# Business Accounting App

A full-stack accounting application for tracking business income and expenses with PostgreSQL storage.

## Overview

This is a React + Node.js application for managing business finances. It allows you to track:
- Employee salaries
- Administrative costs
- Software subscriptions
- Other business expenses
- Income sources

## Current Features

- **Dashboard**: View total income, expenses, and net balance at a glance
- **Entry Management**: Add, edit, and delete financial entries
- **Categories**: Pre-defined categories (Employee, Administration, Software, Marketing, Equipment, Other)
- **Dual Amount Tracking**: Track both base amount and total amount (including taxes/fees)
- **Type Toggle**: Mark entries as either income or expense
- **Date Tracking**: Record transaction dates for each entry
- **PostgreSQL Storage**: Persistent data storage with relational database
- **RESTful API**: Backend API for data operations
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- **React**: UI library
- **Axios**: HTTP client for API calls
- **Lucide React**: Icons
- **Tailwind CSS**: Styling (utility classes only)
- **Vite**: Build tool and dev server

### Backend
- **Node.js**: Runtime environment
- **Express**: Web framework
- **PostgreSQL**: Database
- **pg**: PostgreSQL client for Node.js
- **CORS**: Cross-origin resource sharing

## Project Structure

```
/
├── README.md                           # This file
├── BACKEND_SETUP.md                    # PostgreSQL & Node.js backend setup
├── FRONTEND_API_INTEGRATION.md         # API integration guide
├── COMPONENT.md                        # Frontend component code
├── STRUCTURE.md                        # File/folder structure
├── FEATURES_ROADMAP.md                 # Future expansion ideas
├── SETUP.md                            # Development setup instructions
└── CLAUDE_CODE.md                      # Instructions for Claude Code

frontend/
├── src/
│   ├── components/AccountingApp.jsx
│   ├── services/
│   │   ├── api.js
│   │   └── entryService.js
│   └── ...
└── ...

backend/
├── src/
│   ├── config/database.js
│   ├── models/entryModel.js
│   ├── controllers/entryController.js
│   ├── routes/entryRoutes.js
│   └── server.js
├── migrations/
│   └── 001_initial_schema.sql
└── ...
```

## Quick Start

### Prerequisites
- Node.js v16+
- PostgreSQL 14+
- npm or yarn

### 1. Database Setup
```bash
# Start PostgreSQL (or use Docker - see BACKEND_SETUP.md)
docker-compose up -d

# Run migrations
psql -U accounting_user -d accounting_db -f backend/migrations/001_initial_schema.sql
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your API URL
npm run dev
```

Visit `http://localhost:5173` to use the app.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | Get all entries |
| GET | `/api/entries/:id` | Get single entry |
| POST | `/api/entries` | Create new entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry |
| GET | `/api/entries/totals` | Get totals |

## Development

See `SETUP.md` for detailed development setup instructions.
See `BACKEND_SETUP.md` for PostgreSQL and backend configuration.
See `FRONTEND_API_INTEGRATION.md` for API integration details.