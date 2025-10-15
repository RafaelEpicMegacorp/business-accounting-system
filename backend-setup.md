# Backend Setup with PostgreSQL

## Architecture Overview

```
Frontend (React)  →  Backend API (Node.js/Express)  →  PostgreSQL Database
```

## Prerequisites

- **Node.js**: v16+
- **PostgreSQL**: v14+ (installed locally or via Docker)
- **npm** or **yarn**

## Quick Start with Docker (Recommended)

### 1. Create docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: accounting_db
    environment:
      POSTGRES_USER: accounting_user
      POSTGRES_PASSWORD: accounting_pass
      POSTGRES_DB: accounting_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    container_name: accounting_api
    environment:
      DATABASE_URL: postgresql://accounting_user:accounting_pass@postgres:5432/accounting_db
      PORT: 3001
      NODE_ENV: development
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    volumes:
      - ./backend:/app
      - /app/node_modules

volumes:
  postgres_data:
```

### 2. Start Services

```bash
docker-compose up -d
```

## Manual PostgreSQL Setup

### Install PostgreSQL

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
Download installer from https://www.postgresql.org/download/windows/

### Create Database

```bash
# Access PostgreSQL
psql postgres

# Create user and database
CREATE USER accounting_user WITH PASSWORD 'accounting_pass';
CREATE DATABASE accounting_db OWNER accounting_user;
GRANT ALL PRIVILEGES ON DATABASE accounting_db TO accounting_user;

# Exit
\q
```

## Backend Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js         # PostgreSQL connection
│   ├── controllers/
│   │   └── entryController.js  # Business logic
│   ├── routes/
│   │   └── entryRoutes.js      # API routes
│   ├── models/
│   │   └── entryModel.js       # Database queries
│   ├── middleware/
│   │   ├── errorHandler.js     # Error handling
│   │   └── validator.js        # Input validation
│   └── server.js               # Entry point
├── migrations/
│   └── 001_initial_schema.sql  # Database schema
├── .env.example
├── .env
├── package.json
└── Dockerfile
```

## Database Schema

### Create migrations/001_initial_schema.sql

```sql
-- Create entries table
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    detail TEXT,
    base_amount DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_entries_type ON entries(type);
CREATE INDEX idx_entries_category ON entries(category);
CREATE INDEX idx_entries_date ON entries(entry_date);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data
INSERT INTO entries (type, category, description, detail, base_amount, total) VALUES
('expense', 'Employee', 'Salary', 'AJ', 10000.00, 10000.00),
('expense', 'Employee', 'Asif', 'Employee', 3000.00, 3360.00),
('expense', 'Employee', 'Shaheer', 'Employee', 3000.00, 3360.00),
('expense', 'Employee', 'Danche', 'Employee', 2800.00, 3136.00),
('expense', 'Employee', 'Rohit', 'Employee', 0.00, 0.00),
('expense', 'Employee', 'Yavuz', 'Employee', 3000.00, 3360.00),
('expense', 'Employee', 'Tihomir', 'Employee', 100.00, 112.00),
('expense', 'Employee', 'Mariele', 'Employee', 1600.00, 1792.00),
('expense', 'Employee', 'Joel', 'Employee', 1600.00, 1792.00),
('expense', 'Administration', 'Rent', '', 1000.00, 1120.00),
('expense', 'Administration', 'Internet/Electricity', '', 250.00, 280.00),
('expense', 'Employee', 'Rafael', 'Employee', 10000.00, 11200.00),
('expense', 'Employee', 'Bushan', 'Employee', 3000.00, 3360.00),
('expense', 'Software', 'Softwares', 'Clickup, Slack, Google Cloud, Claude', 1200.00, 1344.00);
```

### Run Migration

```bash
# Using psql
psql -U accounting_user -d accounting_db -f migrations/001_initial_schema.sql

# Or with Docker
docker exec -i accounting_db psql -U accounting_user -d accounting_db < migrations/001_initial_schema.sql
```

## Backend Implementation

### 1. Initialize Backend Project

```bash
mkdir backend
cd backend
npm init -y
npm install express pg dotenv cors
npm install -D nodemon
```

### 2. Create .env

```bash
DATABASE_URL=postgresql://accounting_user:accounting_pass@localhost:5432/accounting_db
PORT=3001
NODE_ENV=development
```

### 3. Create src/config/database.js

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

module.exports = pool;
```

### 4. Create src/models/entryModel.js

```javascript
const pool = require('../config/database');

const EntryModel = {
  // Get all entries
  async getAll() {
    const result = await pool.query(
      'SELECT * FROM entries ORDER BY entry_date DESC, id DESC'
    );
    return result.rows;
  },

  // Get entry by ID
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM entries WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Create new entry
  async create(entry) {
    const { type, category, description, detail, baseAmount, total, entryDate } = entry;
    const result = await pool.query(
      `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [type, category, description, detail || '', baseAmount, total, entryDate || new Date()]
    );
    return result.rows[0];
  },

  // Update entry
  async update(id, entry) {
    const { type, category, description, detail, baseAmount, total, entryDate } = entry;
    const result = await pool.query(
      `UPDATE entries 
       SET type = $1, category = $2, description = $3, detail = $4, 
           base_amount = $5, total = $6, entry_date = $7
       WHERE id = $8
       RETURNING *`,
      [type, category, description, detail || '', baseAmount, total, entryDate, id]
    );
    return result.rows[0];
  },

  // Delete entry
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM entries WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  // Get totals
  async getTotals() {
    const result = await pool.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN total ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN total ELSE 0 END) as total_expenses,
        SUM(CASE WHEN type = 'income' THEN total ELSE -total END) as net_balance
      FROM entries
    `);
    return result.rows[0];
  }
};

module.exports = EntryModel;
```

### 5. Create src/controllers/entryController.js

```javascript
const EntryModel = require('../models/entryModel');

const EntryController = {
  // GET /api/entries
  async getAll(req, res, next) {
    try {
      const entries = await EntryModel.getAll();
      res.json(entries);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/:id
  async getById(req, res, next) {
    try {
      const entry = await EntryModel.getById(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.json(entry);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/entries
  async create(req, res, next) {
    try {
      const entry = await EntryModel.create(req.body);
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/entries/:id
  async update(req, res, next) {
    try {
      const entry = await EntryModel.update(req.params.id, req.body);
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.json(entry);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/entries/:id
  async delete(req, res, next) {
    try {
      const entry = await EntryModel.delete(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/totals
  async getTotals(req, res, next) {
    try {
      const totals = await EntryModel.getTotals();
      res.json(totals);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = EntryController;
```

### 6. Create src/routes/entryRoutes.js

```javascript
const express = require('express');
const router = express.Router();
const EntryController = require('../controllers/entryController');

router.get('/totals', EntryController.getTotals);
router.get('/', EntryController.getAll);
router.get('/:id', EntryController.getById);
router.post('/', EntryController.create);
router.put('/:id', EntryController.update);
router.delete('/:id', EntryController.delete);

module.exports = router;
```

### 7. Create src/server.js

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const entryRoutes = require('./routes/entryRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/entries', entryRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### 8. Update package.json

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
```

## Start Backend

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | Get all entries |
| GET | `/api/entries/:id` | Get single entry |
| POST | `/api/entries` | Create new entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry |
| GET | `/api/entries/totals` | Get income/expense totals |
| GET | `/health` | Health check |

## Testing API

```bash
# Get all entries
curl http://localhost:3001/api/entries

# Create entry
curl -X POST http://localhost:3001/api/entries \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "category": "Software",
    "description": "GitHub Subscription",
    "detail": "Pro plan",
    "baseAmount": 100,
    "total": 100
  }'

# Get totals
curl http://localhost:3001/api/entries/totals
```

## Next Steps

See `FRONTEND_API_INTEGRATION.md` for connecting the React frontend to this backend.