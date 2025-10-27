# Wise API Testing Scripts

Collection of scripts to test Wise API integration.

## Prerequisites

1. **Wise API Token**: Get from https://wise.com or https://sandbox.wise.com
2. **Node.js**: Version 18+ with native fetch support
3. **Environment Setup**: Set API token in `.env` file

## Setup

### 1. Add API Token to .env

**Backend `.env` file:**
```bash
# Wise API Configuration
WISE_API_TOKEN=your-api-token-here
WISE_API_URL=https://api.wise.com  # or sandbox URL
```

**For Railway (Production):**
```bash
# Set via Railway dashboard or CLI
railway variables set WISE_API_TOKEN=your-token-here
```

### 2. Make Scripts Executable

```bash
chmod +x backend/scripts/test-wise-*.js
```

## Scripts

### 1. Test Profile (Get User Profiles)

**Purpose**: Verify API token works and get profile ID.

**Usage:**
```bash
cd backend
node scripts/test-wise-profile.js
```

**What it does:**
- Connects to Wise API
- Fetches all profiles for your account
- Displays profile information
- Shows profile ID needed for other scripts

**Example Output:**
```
============================================================
User Profiles
============================================================
✓ Found 1 profile(s)

Profile 1:
  ID: 12345678
  Type: personal
  Name: John Doe
  DOB: 1990-01-01
  Phone: +1234567890

============================================================
Next Steps
============================================================
ℹ Use this profile ID for other Wise API calls:
  12345678
```

---

### 2. Test Balances (Get Currency Balances)

**Purpose**: Fetch all currency balances for a profile.

**Usage:**
```bash
cd backend
node scripts/test-wise-balances.js <profileId>

# Or set environment variable
export WISE_PROFILE_ID=12345678
node scripts/test-wise-balances.js
```

**What it does:**
- Lists all currency balances (USD, EUR, GBP, PLN, etc.)
- Shows available, reserved, and total amounts
- Provides balance IDs needed for statements
- Estimates total in USD

**Example Output:**
```
============================================================
Currency Balances
============================================================
✓ Found 3 balance(s)

EUR Balance:
  Balance ID: 200001
  Type: STANDARD
  Available: 1250.50 EUR
  Reserved: 0.00 EUR
  Cash: 1250.50 EUR
  Total Worth: 1250.50 EUR

USD Balance:
  Balance ID: 200002
  Available: 5000.00 USD
  ...
```

---

### 3. Test Statement (Get Transaction History)

**Purpose**: Fetch transaction history for a specific balance.

**Usage:**
```bash
cd backend
node scripts/test-wise-statement.js <profileId> <balanceId> <currency>

# Example
node scripts/test-wise-statement.js 12345678 200001 EUR
```

**What it does:**
- Fetches transactions for the last 30 days
- Shows credits (incoming) and debits (outgoing)
- Displays transaction details (type, amount, reference)
- Shows running balance after each transaction

**Example Output:**
```
============================================================
Balance Statement
============================================================
ℹ Fetching transactions from 2025-01-01 to 2025-01-30...
✓ HTTP 200 OK

============================================================
Transactions
============================================================
✓ Found 15 transaction(s)

Transaction 1:
  Date: 2025-01-15T10:30:00Z
  Type: CREDIT (+)
  Amount: 1000.00 EUR
  Fee: 0.00 EUR
  Details: Received money from John Doe
  Reference: TRANSFER-12345678
  Running Balance: 1250.50 EUR
```

---

## Testing Workflow

### Step-by-Step Testing

```bash
# 1. Test connection and get profile ID
node scripts/test-wise-profile.js

# 2. Get balances (use profile ID from step 1)
node scripts/test-wise-balances.js 12345678

# 3. Get transaction history (use balance ID and currency from step 2)
node scripts/test-wise-statement.js 12345678 200001 EUR
```

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WISE_API_TOKEN` | Yes | Your Wise API token | `abc123...` |
| `WISE_PROFILE_ID` | Optional | Your profile ID | `12345678` |
| `WISE_API_URL` | Optional | API base URL | `https://api.wise.com` |

---

## Sandbox vs Production

### Sandbox (Testing)

**URL**: `https://api.sandbox.wise.com`

**Setup:**
1. Sign up at https://sandbox.wise.com
2. Generate API token from settings
3. Set in `.env`:
   ```bash
   WISE_API_URL=https://api.sandbox.wise.com
   WISE_API_TOKEN=your-sandbox-token
   ```

**Features:**
- Free to use
- Simulated transactions
- No real money
- Same API structure

---

### Production

**URL**: `https://api.wise.com`

**Setup:**
1. Get API token from https://wise.com
2. Set in `.env`:
   ```bash
   WISE_API_URL=https://api.wise.com
   WISE_API_TOKEN=your-production-token
   ```

**Note**: Production token requires account verification.

---

## Common Issues

### Issue: 401 Unauthorized

**Cause**: Invalid or missing API token

**Solution:**
```bash
# Check token is set
echo $WISE_API_TOKEN

# Re-generate token at wise.com
# Update .env file
WISE_API_TOKEN=new-token-here
```

---

### Issue: 403 Forbidden

**Cause**: API token lacks required permissions

**Solution:**
- Check token has "Read" permissions
- Generate new token with correct scopes
- For SCA-protected endpoints, use personal token (not OAuth)

---

### Issue: 404 Not Found

**Cause**: Wrong profile ID or balance ID

**Solution:**
```bash
# Get correct profile ID
node scripts/test-wise-profile.js

# Get correct balance ID
node scripts/test-wise-balances.js <profileId>
```

---

### Issue: Connection Timeout

**Cause**: Network issues or incorrect API URL

**Solution:**
```bash
# Check API URL
echo $WISE_API_URL

# Test connection
curl -H "Authorization: Bearer $WISE_API_TOKEN" \
  https://api.wise.com/v2/profiles
```

---

## Testing on Railway

### Run via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Run script
railway run node backend/scripts/test-wise-profile.js
```

### Run via Railway SSH

```bash
# SSH into Railway container
railway ssh

# Run script
node backend/scripts/test-wise-profile.js
```

### Set Environment Variables

```bash
# Via CLI
railway variables set WISE_API_TOKEN=your-token-here

# Via Dashboard
# Go to railway.app → Your Project → Variables
# Add: WISE_API_TOKEN = your-token-here
```

---

## Script Output Colors

Scripts use color-coded output for easy reading:

- 🟢 **Green**: Success messages
- 🔴 **Red**: Errors
- 🔵 **Blue**: Information
- 🟡 **Yellow**: Warnings
- 🟦 **Cyan**: Headers and important data

---

## Security Notes

1. **Never commit API tokens** to version control
2. **Use .env files** for local development
3. **Use Railway variables** for production
4. **Rotate tokens** regularly
5. **Use sandbox** for testing

---

## Next Steps

After successful testing:

1. ✅ Verify token works with all 3 scripts
2. ✅ Document your profile ID
3. ✅ Document your balance IDs
4. 🔜 Implement automated sync in backend
5. 🔜 Setup webhooks for real-time updates
6. 🔜 Replace CSV import with API calls

---

## Related Documentation

- [Wise API Reference](../../DOCS/API/WISE_API_REFERENCE.md)
- [Internal API Reference](../../DOCS/API/INTERNAL_API.md)
- [Official Wise Docs](https://docs.wise.com/api-docs/)

---

**Last Updated**: 2025-10-27
