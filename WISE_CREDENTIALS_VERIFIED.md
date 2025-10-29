# Wise API Credentials - Verified and Working

**Date**: October 28, 2025
**Status**: ✅ VERIFIED AND ACTIVE

## Production Credentials

```bash
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=10b1f19c-bd61-4c9b-8d86-1ec264550ad4
WISE_PROFILE_ID=74801125  # Business: Deploy Staff Sp. z o.o.
```

## Account Details

### Business Profile (ACTIVE)
- **Profile ID**: `74801125`
- **Name**: Deploy Staff Sp. z o.o.
- **Type**: Business
- **Registration Number**: 5273168698
- **Business Category**: IT Development / Consulting
- **Website**: deploystaff.com

### Current Balances (as of Oct 28, 2025)
- **USD**: $33,622.12 (Primary)
- **PLN**: 7,534.59 PLN
- **EUR**: €0.00
- **GBP**: £0.00

### Personal Profile (Available but not used)
- **Profile ID**: `74801255`
- **Name**: Celso Rafael Vieira
- **Type**: Personal

## Token Details

- **Token Type**: Personal API Token
- **Permissions**: Read access (profiles, balances, activities, transfers)
- **Created**: October 2025
- **Verified**: October 28, 2025 17:52 UTC
- **Status**: Active
- **Security**: Read-only (cannot make transfers)

## Verification Tests

### Test 1: List Profiles
```bash
curl -H "Authorization: Bearer 10b1f19c-bd61-4c9b-8d86-1ec264550ad4" \
  https://api.wise.com/v1/profiles
```
**Result**: ✅ SUCCESS - Returns 2 profiles (personal + business)

### Test 2: Get Business Balances
```bash
curl -H "Authorization: Bearer 10b1f19c-bd61-4c9b-8d86-1ec264550ad4" \
  "https://api.wise.com/v4/profiles/74801125/balances?types=STANDARD"
```
**Result**: ✅ SUCCESS - Returns 4 currency balances (USD, PLN, EUR, GBP)

## Railway Configuration

**Required Environment Variables**:
```
WISE_API_URL=https://api.wise.com
WISE_API_TOKEN=10b1f19c-bd61-4c9b-8d86-1ec264550ad4
WISE_PROFILE_ID=74801125
```

**How to Set**:
1. Go to Railway Dashboard
2. Navigate to Project → Variables tab
3. Add/update the three variables above
4. Redeploy the backend service

## API Endpoints Verified

- ✅ `GET /v1/profiles` - List all profiles
- ✅ `GET /v4/profiles/{profileId}/balances` - Get balances
- 🔜 `GET /v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json` - Get transactions (next step)

## Next Steps

1. **Update Railway Variables** (URGENT)
   - Set `WISE_API_TOKEN=10b1f19c-bd61-4c9b-8d86-1ec264550ad4`
   - Set `WISE_PROFILE_ID=74801125`
   - Verify `WISE_API_URL=https://api.wise.com`

2. **Test Transaction Sync**
   - Use `/v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json`
   - Get recent transactions for all currencies
   - Verify sync creates entries correctly

3. **Enable Webhooks** (Optional)
   - Create webhook subscription at `/v3/profiles/{profileId}/subscriptions`
   - Set trigger events (transfers.state-change, etc.)
   - Configure webhook URL on backend

## Security Reminders

- ⚠️ **NEVER commit this token to git**
- ✅ Token is in `.env` (gitignored) and Railway only
- 🔄 Rotate token every 90 days
- 🔒 Token has read-only permissions
- 📝 This document is for reference only

## Documentation Locations

- **Primary**: `/Users/rafael/Windsurf/accounting/.claude/CLAUDE.md` (Section: "Wise API Setup & Configuration")
- **Environment**: `/Users/rafael/Windsurf/accounting/backend/.env.example`
- **This File**: `/Users/rafael/Windsurf/accounting/WISE_CREDENTIALS_VERIFIED.md`

---

**Last Verified**: October 28, 2025 17:52 UTC
**Next Verification Due**: January 28, 2026 (90 days)
