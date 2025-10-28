# Wise Account Connection Debug Investigation

**Date**: October 28, 2025
**Issue**: User reports business account has many transactions, but API returns 0
**Current Profile ID**: 74801255

---

## Problem Statement

- **User confirms**: Deploys Staff business Wise account has many transactions
- **API returns**: 0 activities, 0 balances for profile 74801255
- **Likely cause**: Connected to wrong Wise profile (personal vs business account)

---

## Investigation Steps

### Step 1: List All Available Wise Profiles

**Endpoint**: `GET /api/wise/debug/list-profiles`

This will call:
```
GET https://api.wise.com/v1/profiles
Authorization: Bearer {WISE_API_TOKEN}
```

**Expected Response**:
```json
[
  {
    "id": 74801255,
    "type": "personal",
    "details": {
      "firstName": "...",
      "lastName": "..."
    }
  },
  {
    "id": XXXXXXX,
    "type": "business",
    "details": {
      "name": "Deploys Staff" or similar
    }
  }
]
```

**What to look for**:
- Profile with `type: "business"`
- Profile name containing "Deploys Staff" or business name
- Different profile ID from current (74801255)

---

### Step 2: Check Each Profile for Activity

**Endpoint**: `GET /api/wise/debug/test-profile/{profileId}`

For each profile ID found in Step 1, this will test:
1. Activities (transaction history)
2. Balances (multi-currency balances)
3. Balance statements (detailed transactions)

**Tests Performed**:
- `/v1/profiles/{profileId}/activities` - Last 2 years of activity
- `/v4/profiles/{profileId}/balances?types=STANDARD` - Current balances
- Sample balance statement for each currency

**What to look for**:
- Profile with `activities.length > 0`
- Profile with balances > 0 in USD/PLN/EUR
- Transactions that match user's business activity

---

### Step 3: Compare Profile Capabilities

**What we're checking**:
- Personal vs Business account type
- API token access permissions
- Profile ownership (who created the token)

---

## Possible Scenarios

### Scenario A: Wrong Profile ID (Most Likely)
**Symptoms**:
- Profile 74801255 is personal account
- Business profile exists with different ID
- API token has access to both profiles

**Solution**:
1. Identify correct business profile ID from Step 1
2. Update Railway environment variable: `WISE_PROFILE_ID=<business_profile_id>`
3. Redeploy backend
4. Re-run sync

---

### Scenario B: Wrong API Token
**Symptoms**:
- Token is from personal account
- Doesn't have permission to access business profile

**Solution**:
1. Go to Wise business account: wise.com
2. Settings → API tokens
3. Create new token with "Read" permissions
4. Update Railway: `WISE_API_TOKEN=<new_token>`
5. Update Railway: `WISE_PROFILE_ID=<business_profile_id>`
6. Redeploy and re-sync

---

### Scenario C: Missing Permissions
**Symptoms**:
- Token exists but lacks required scopes
- Can see profile but not transactions

**Solution**:
1. Regenerate token with full read permissions
2. Ensure "Read balance" and "Read transactions" are enabled
3. Update Railway variables
4. Redeploy

---

## Debug Endpoint Implementation

### 1. List All Profiles
```http
GET /api/wise/debug/list-profiles
Authorization: Bearer {JWT_TOKEN}
```

**Response**:
```json
{
  "success": true,
  "profiles": [
    {
      "id": 74801255,
      "type": "personal",
      "name": "John Doe",
      "primaryCurrency": "USD",
      "capabilities": ["..."]
    },
    {
      "id": 12345678,
      "type": "business",
      "name": "Deploys Staff",
      "primaryCurrency": "USD",
      "capabilities": ["..."]
    }
  ],
  "currentProfile": 74801255,
  "recommendedProfile": 12345678
}
```

---

### 2. Test Specific Profile
```http
GET /api/wise/debug/test-profile/{profileId}
Authorization: Bearer {JWT_TOKEN}
```

**Response**:
```json
{
  "success": true,
  "profileId": 12345678,
  "profileInfo": {
    "id": 12345678,
    "type": "business",
    "name": "Deploys Staff"
  },
  "tests": {
    "activities": {
      "status": "PASSED",
      "count": 156,
      "sample": [...]
    },
    "balances": {
      "status": "PASSED",
      "currencies": {
        "USD": 33622.12,
        "PLN": 7534.59,
        "EUR": 0
      }
    },
    "statements": {
      "status": "PASSED",
      "transactionCount": 150
    }
  },
  "recommendation": "✅ This profile has transactions - use this one!"
}
```

---

### 3. Test All Profiles
```http
GET /api/wise/debug/test-all-profiles
Authorization: Bearer {JWT_TOKEN}
```

**Response**:
```json
{
  "success": true,
  "profiles": [
    {
      "id": 74801255,
      "type": "personal",
      "name": "John Doe",
      "hasActivity": false,
      "balanceUSD": 0,
      "activityCount": 0,
      "recommendation": "❌ Empty - don't use"
    },
    {
      "id": 12345678,
      "type": "business",
      "name": "Deploys Staff",
      "hasActivity": true,
      "balanceUSD": 33622.12,
      "activityCount": 156,
      "recommendation": "✅ USE THIS ONE"
    }
  ],
  "currentProfileId": 74801255,
  "recommendedProfileId": 12345678,
  "action": "Update WISE_PROFILE_ID to 12345678"
}
```

---

## How to Fix

### Once Correct Profile is Identified:

1. **Update Railway Environment Variables**:
   ```bash
   # Via Railway CLI
   railway variables --set "WISE_PROFILE_ID=12345678"

   # Or via Railway Dashboard:
   # railway.app → Project → Variables → Edit WISE_PROFILE_ID
   ```

2. **Redeploy Backend**:
   ```bash
   # Railway auto-deploys on variable change
   # Or manually trigger: railway up
   ```

3. **Test Connection**:
   ```bash
   curl https://business-accounting-system-production.up.railway.app/api/wise-test/test-all
   ```

4. **Re-sync Transactions**:
   - Frontend: Dashboard → Sync Wise
   - Backend: `POST /api/wise/sync`

5. **Verify Results**:
   - Income tab should show transactions
   - Balances should match Wise dashboard
   - Both income and expense entries should appear

---

## Testing Checklist

- [ ] Run `GET /api/wise/debug/list-profiles` to see all profiles
- [ ] Identify which profile is "business" type
- [ ] Run `GET /api/wise/debug/test-profile/{businessProfileId}` to confirm it has transactions
- [ ] Note the correct business profile ID
- [ ] Update `WISE_PROFILE_ID` in Railway to business profile ID
- [ ] Wait for auto-redeploy (or manually trigger)
- [ ] Test connection with `/api/wise-test/test-all`
- [ ] Run Wise sync from dashboard
- [ ] Verify Income tab shows transactions
- [ ] Verify balances match Wise dashboard

---

## Current Configuration

**Environment Variables (Railway)**:
- `WISE_API_URL`: https://api.wise.com
- `WISE_API_TOKEN`: (API token - check which account it's from)
- `WISE_PROFILE_ID`: 74801255 (currently set - likely wrong)

**Profile 74801255 Results**:
- Type: Unknown (need to verify)
- Activities: 0
- Balances: USD $0, PLN $0, EUR $0
- Conclusion: Empty or wrong account

---

## Next Steps

1. Implement debug endpoints (see below)
2. Test locally or in production
3. Identify correct business profile ID
4. Update Railway environment variable
5. Redeploy and re-sync
6. Document correct configuration in CLAUDE.md

---

## Debug Endpoint Code

See: `backend/src/routes/wiseDebug.js` (to be created)

Routes:
- `GET /api/wise/debug/list-profiles` - List all profiles
- `GET /api/wise/debug/test-profile/:profileId` - Test specific profile
- `GET /api/wise/debug/test-all-profiles` - Test all profiles
- `GET /api/wise/debug/current-config` - Show current environment configuration

All endpoints require authentication (JWT token).

---

## Success Criteria

- ✅ Identified correct business profile ID
- ✅ Verified business profile has transactions via API
- ✅ Updated WISE_PROFILE_ID environment variable
- ✅ Re-deployed backend with new configuration
- ✅ Tested connection successfully
- ✅ Synced transactions and see income entries
- ✅ Balances match Wise dashboard
- ✅ Both income and expense transactions appear

---

**Status**: INVESTIGATION IN PROGRESS
**Created**: 2025-10-28
**Last Updated**: 2025-10-28
