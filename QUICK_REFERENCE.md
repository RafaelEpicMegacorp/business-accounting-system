# 🚀 Quick Reference Card

## 🌐 Access Your Application

**Frontend**: http://localhost:5173
**Backend API**: http://localhost:3001
**Status**: ✅ RUNNING NOW

## 🎯 Test Date Tracking (5 minutes)

1. **Open browser**: http://localhost:5173
2. **Click "Add Entry"**
3. **Notice**: Date field shows today's date ✅
4. **Fill form**:
   - Description: "My Test Entry"
   - Base Amount: 100
   - Total: 100
5. **Click "Add Entry"**
6. **Verify**: Entry appears in table with today's date
7. **Change date**: Click edit, change date to last month
8. **Save**: Date updates in table
9. **Refresh page**: Date persists ✅

## 📊 What You'll See

### Dashboard Cards
- 🟢 Total Income (green)
- 🔴 Total Expenses (red)
- 🔵 Net Balance (blue)

### Entries Table
- 📅 Date (first column)
- Type (Income/Expense badge)
- Category, Description, Details
- Base Amount, Total
- ✏️ Edit | 🗑️ Delete actions

## 🔧 Management

### Check Status
```bash
# Backend
curl http://localhost:3001/health

# Database
PGPASSWORD=accounting_pass psql -U accounting_user -d accounting_db -c "SELECT COUNT(*) FROM entries;"
```

### View Logs
```bash
cd /Users/rafael/Windsurf/accounting
tail -f backend.log    # Backend logs
tail -f frontend.log   # Frontend logs
```

### Stop Services
```bash
# Stop backend (PID: 70741)
kill 70741

# Stop frontend (PID: 71441)
kill 71441

# Or by port
kill $(lsof -ti:3001)  # Backend
kill $(lsof -ti:5173)  # Frontend
```

### Restart Services
```bash
cd /Users/rafael/Windsurf/accounting

# Backend
cd backend && npm run dev > ../backend.log 2>&1 &

# Frontend
cd frontend && npm run dev > ../frontend.log 2>&1 &
```

## 🗃️ Database Quick Access

```bash
# Connect
PGPASSWORD=accounting_pass psql -U accounting_user -d accounting_db

# View entries
SELECT id, description, entry_date, total FROM entries ORDER BY entry_date DESC LIMIT 10;

# Count entries
SELECT COUNT(*) FROM entries;

# Exit
\q
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| **DEPLOYMENT_SUMMARY.md** | Complete deployment status |
| **TEST_RESULTS.md** | API test results |
| **SETUP_INSTRUCTIONS.md** | Full setup guide |
| **README.md** | Project overview |

## ✅ What's Working

- ✅ PostgreSQL database (15 entries)
- ✅ Backend API (all endpoints)
- ✅ Frontend UI (React + Vite)
- ✅ Date tracking (create, edit, display)
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Sorting by date (newest first)
- ✅ Data persistence

## 🆘 Troubleshooting

**Backend not responding?**
```bash
tail -f backend.log
# Restart: cd backend && npm run dev
```

**Frontend not loading?**
```bash
tail -f frontend.log
# Restart: cd frontend && npm run dev
```

**Database issues?**
```bash
PGPASSWORD=accounting_pass psql -U accounting_user -d accounting_db
\dt  # List tables
```

## 🎯 Next Steps

1. ✅ Test the UI at http://localhost:5173
2. 🔜 Add date range filtering
3. 🔜 Export to CSV
4. 🔜 Add charts

---

**Status**: 🟢 ALL SYSTEMS OPERATIONAL

**Need Help?** Check DEPLOYMENT_SUMMARY.md or SETUP_INSTRUCTIONS.md
