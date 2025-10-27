# Accounting System Documentation

Complete documentation for the Business Accounting System.

---

## 📚 Documentation Index

### API Documentation

**🎯 Start Here**: [API Quick Reference](API/API_QUICK_REFERENCE.md) - Fast lookup for all endpoints

| Document | Description | Endpoints |
|----------|-------------|-----------|
| **[Internal API Reference](API/INTERNAL_API.md)** | Complete backend API documentation | 51 endpoints |
| **[Wise API Reference](API/WISE_API_REFERENCE.md)** | Wise integration endpoints and guides | 21+ endpoints |
| **[API Quick Reference](API/API_QUICK_REFERENCE.md)** | Quick lookup tables and common patterns | All |

### Architecture Documentation

| Document | Description |
|----------|-------------|
| **Database Schema** | See main [CLAUDE.md](../.claude/CLAUDE.md#database-schema) |
| **Tech Stack** | See main [CLAUDE.md](../.claude/CLAUDE.md#tech-stack) |

---

## 🚀 Quick Start

### For Developers

1. **Setup**: Read [../README.md](../README.md) for environment setup
2. **API Docs**: Start with [API Quick Reference](API/API_QUICK_REFERENCE.md)
3. **Test**: Login with `username: rafael`, `password: asdflkj@3!`
4. **Explore**: Use [Internal API Reference](API/INTERNAL_API.md) for detailed endpoints

### For Wise Integration

1. **Overview**: Read [Wise API Reference](API/WISE_API_REFERENCE.md)
2. **Use Cases**: See common patterns in the reference
3. **Testing**: Use sandbox environment for development
4. **Production**: Freelancer is implementing full API integration

---

## 📖 Documentation Structure

```
DOCS/
├── README.md                          # This file
├── API/
│   ├── INTERNAL_API.md               # Backend API (51 endpoints)
│   ├── WISE_API_REFERENCE.md         # Wise API integration guide
│   └── API_QUICK_REFERENCE.md        # Fast lookup tables
└── ARCHITECTURE/
    └── (Future: detailed architecture docs)
```

---

## 🔍 Finding What You Need

### I want to...

**...authenticate a user**
→ [Internal API: Authentication](API/INTERNAL_API.md#authentication)

**...create an entry**
→ [Internal API: POST /api/entries](API/INTERNAL_API.md#post-apientries)

**...import Wise transactions**
→ [Internal API: Wise Import](API/INTERNAL_API.md#wise-import)
→ [Wise API: Balance Statements](API/WISE_API_REFERENCE.md#balance-statements)

**...manage employees**
→ [Internal API: Employees](API/INTERNAL_API.md#employees)

**...setup webhooks**
→ [Wise API: Webhooks](API/WISE_API_REFERENCE.md#webhooks)

**...get dashboard data**
→ [Internal API: Dashboard](API/INTERNAL_API.md#dashboard)

**...work with multi-currency**
→ [Internal API: Currency](API/INTERNAL_API.md#currency)
→ [Wise API: Balance Management](API/WISE_API_REFERENCE.md#balance-management)

**...quick endpoint lookup**
→ [API Quick Reference](API/API_QUICK_REFERENCE.md)

---

## 📝 API Documentation Highlights

### Internal API (51 endpoints)

- ✅ **Authentication**: JWT-based auth with login/logout
- ✅ **Entries**: Full CRUD + bulk operations + salary generation
- ✅ **Employees**: Management with termination workflow
- ✅ **Contracts**: Recurring income automation
- ✅ **Dashboard**: Statistics and charts
- ✅ **Currency**: Multi-currency support (USD, EUR, PLN, GBP)
- ✅ **Wise Import**: CSV upload and processing

**Base URL**: `http://localhost:3001` (dev) | `https://business-accounting-system-production.up.railway.app` (prod)

### Wise API (21+ endpoints)

- ✅ **Profiles**: Get user profile information
- ✅ **Balances**: List, get, create currency balances
- ✅ **Statements**: Retrieve transaction history (JSON/CSV/PDF)
- ✅ **Webhooks**: Real-time event notifications
- ✅ **Conversions**: Exchange currencies within account

**Base URL**: `https://api.sandbox.transferwise.tech` (sandbox) | `https://api.transferwise.com` (prod)

---

## 🎯 Common Use Cases

### Use Case 1: Create an Expense Entry

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "rafael", "password": "asdflkj@3!"}'

# Create entry
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

**Docs**: [Internal API - Entries](API/INTERNAL_API.md#entries)

---

### Use Case 2: Import Wise Transactions

```bash
# Upload CSV file
curl -X POST http://localhost:3001/api/wise/import \
  -H "Authorization: Bearer <token>" \
  -F "csvFile=@wise_statement.csv"
```

**Docs**: [Internal API - Wise Import](API/INTERNAL_API.md#wise-import)

---

### Use Case 3: Get Wise Balance (API Integration)

```bash
# Get all balances
curl -X GET "https://api.transferwise.com/v4/profiles/12345678/balances?types=STANDARD" \
  -H "Authorization: Bearer <wise-api-token>"
```

**Docs**: [Wise API - Balance Management](API/WISE_API_REFERENCE.md#list-balances-for-profile)

---

### Use Case 4: Setup Wise Webhook

```bash
# Create webhook subscription
curl -X POST "https://api.transferwise.com/v3/profiles/12345678/subscriptions" \
  -H "Authorization: Bearer <wise-api-token>" \
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

**Docs**: [Wise API - Webhooks](API/WISE_API_REFERENCE.md#create-profile-webhook-subscription)

---

## 🔐 Authentication

### Internal API

**Method**: JWT Bearer Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "rafael",
  "password": "asdflkj@3!"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

Use token in all subsequent requests:
```http
Authorization: Bearer <token>
```

**Docs**: [Internal API - Authentication](API/INTERNAL_API.md#authentication)

---

### Wise API

**Method**: API Token

```http
Authorization: Bearer <wise-api-token>
```

Get API token from:
- **Sandbox**: https://sandbox.transferwise.tech
- **Production**: https://wise.com (Settings → API tokens)

**Docs**: [Wise API - Authentication](API/WISE_API_REFERENCE.md#authentication)

---

## 🛠️ Development Tools

### Testing Endpoints

**Postman/Insomnia**: Import endpoints from documentation

**curl**: Copy-paste examples from API docs

**Browser DevTools**: Inspect frontend API calls

### Database Tools

**pgAdmin**: Visual database management

**psql**: Command-line PostgreSQL client

```bash
# Connect to local database
psql -U accounting_user -d accounting_db

# Connect to Railway (production)
psql postgresql://postgres:password@host:port/railway
```

### API Testing Dashboard

**URL**: http://localhost:4000

Comprehensive testing suite for 42+ endpoints with modern UI.

**Start**: `npm run test-dashboard` (from backend directory)

---

## 📊 Response Formats

All APIs return JSON format:

### Success Response
```json
{
  "id": 1,
  "name": "Resource Name",
  "status": "success",
  ...
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional details"
}
```

### Status Codes
- `200 OK` - Successful GET/PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Missing/invalid auth
- `404 Not Found` - Resource not found
- `500 Server Error` - Internal error

---

## 🌐 Environments

### Local Development

- **Frontend**: http://localhost:7392
- **Backend**: http://localhost:3001
- **Database**: localhost:5432

**Start**: `./start-local-dev.sh` from project root

---

### Production

- **Frontend**: https://ds-accounting.netlify.app
- **Backend**: https://business-accounting-system-production.up.railway.app
- **Database**: Railway PostgreSQL (managed)

**Deploy**: Auto-deploy from `live` branch

---

## 📚 Related Documentation

### Project Documentation

- **[Main README](../README.md)**: Project overview and setup
- **[CLAUDE.md](../.claude/CLAUDE.md)**: Complete project instructions
- **[Setup Instructions](../SETUP_INSTRUCTIONS.md)**: Detailed setup guide

### External Documentation

- **[Wise API Docs](https://docs.wise.com/api-docs/)**: Official Wise API documentation
- **[PostgreSQL Docs](https://www.postgresql.org/docs/)**: Database documentation
- **[React Docs](https://react.dev/)**: Frontend framework
- **[Express Docs](https://expressjs.com/)**: Backend framework

---

## 🔄 Keeping Documentation Updated

### When to Update

1. **New Endpoints**: Add to Internal API Reference
2. **Changed Endpoints**: Update affected documentation
3. **New Features**: Update relevant sections
4. **Bug Fixes**: Update notes if behavior changes

### Update Process

1. Update relevant markdown file(s)
2. Update quick reference if needed
3. Update this README index if structure changes
4. Commit with descriptive message

---

## 💡 Tips for Using Documentation

### Best Practices

1. **Start with Quick Reference**: Fast lookup for endpoint paths
2. **Read Full Docs**: For detailed parameters and examples
3. **Test in Sandbox**: Use Wise sandbox for integration testing
4. **Copy-Paste Examples**: All curl examples are ready to use
5. **Check Error Codes**: Common issues documented

### Navigation Tips

- Use table of contents in each document
- Ctrl+F / Cmd+F to search within documents
- Follow internal links for related topics
- Check "Common Use Cases" for patterns

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: Can't authenticate
**Solution**: Check credentials and JWT token validity
**Docs**: [Internal API - Authentication](API/INTERNAL_API.md#authentication)

**Issue**: Wise CSV import fails
**Solution**: Verify 21-column format and database connection
**Docs**: [Internal API - Wise Import](API/INTERNAL_API.md#wise-import)

**Issue**: CORS errors in browser
**Solution**: Check CORS_ORIGINS in backend .env
**Docs**: [Internal API - CORS Configuration](API/INTERNAL_API.md#cors-configuration)

**Issue**: Wise API returns 401
**Solution**: Verify API token and permissions
**Docs**: [Wise API - Authentication](API/WISE_API_REFERENCE.md#authentication)

---

## 📞 Support

### Project Issues

- **GitHub Issues**: Report bugs and request features
- **BUGS/ Folder**: Document known issues
- **TASKS/ Folder**: Track feature development

### Wise API Support

- **Official Docs**: https://docs.wise.com/api-docs/
- **Support**: https://wise.com/help/
- **Community**: https://community.wise.com/
- **API Status**: https://status.transferwise.com/

---

## 📄 License & Credits

**Project**: Business Accounting System
**Repository**: https://github.com/RafaelEpicMegacorp/business-accounting-system
**Created**: 2024
**Last Updated**: 2025-10-27

**API Documentation Created**: 2025-10-27
**Total Documentation Lines**: ~2,500+ lines across 4 files

---

## 🎓 Learning Resources

### For API Development

- **REST API Best Practices**: https://restfulapi.net/
- **HTTP Status Codes**: https://httpstatuses.com/
- **JWT Authentication**: https://jwt.io/introduction/
- **API Design Patterns**: https://swagger.io/resources/articles/best-practices-in-api-design/

### For Wise Integration

- **Wise API Guides**: https://docs.wise.com/api-docs/guides/
- **Webhook Best Practices**: https://docs.wise.com/api-docs/webhooks-notifications/
- **Strong Customer Authentication**: https://docs.wise.com/api-docs/guides/strong-customer-authentication-2fa

---

**Happy Coding! 🚀**
