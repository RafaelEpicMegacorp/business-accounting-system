# Testing Wise Profile Configuration

## Quick Test Instructions

### Step 1: Get JWT Token from Production

```bash
curl -X POST https://business-accounting-system-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rafael","password":"asdflkj@3!"}'
```

Save the `token` value from the response.

### Step 2: Check Current Configuration

```bash
TOKEN="<your-token-here>"

curl -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise/debug/current-config
```

**Expected Response**:
```json
{
  "success": true,
  "config": {
    "WISE_API_URL": "https://api.wise.com",
    "WISE_PROFILE_ID": "74801255",
    "WISE_API_TOKEN": "10b1f19c...",
    "tokenConfigured": true,
    "profileConfigured": true
  },
  "warnings": []
}
```

### Step 3: List All Available Profiles

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise/debug/list-profiles
```

**What to look for**:
- Profile with `type: "business"`
- Profile name containing "Deploys Staff"
- Different ID from current (74801255)

**Example Response**:
```json
{
  "success": true,
  "totalProfiles": 2,
  "businessProfiles": 1,
  "personalProfiles": 1,
  "currentProfileId": 74801255,
  "profiles": [
    {
      "id": 74801255,
      "type": "personal",
      "name": "John Doe",
      "isCurrent": true
    },
    {
      "id": 12345678,
      "type": "business",
      "name": "Deploys Staff",
      "isCurrent": false
    }
  ],
  "recommendation": "Found 1 business profile(s)...",
  "nextSteps": ["Test business profile..."]
}
```

### Step 4: Test All Profiles (Recommended)

This will automatically test each profile and tell you which one to use:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise/debug/test-all-profiles
```

**Expected Response**:
```json
{
  "success": true,
  "totalProfiles": 2,
  "currentProfileId": 74801255,
  "recommendedProfileId": 12345678,
  "profiles": [
    {
      "id": 74801255,
      "type": "personal",
      "name": "John Doe",
      "hasActivity": false,
      "activityCount": 0,
      "balances": {
        "USD": 0,
        "PLN": 0,
        "EUR": 0
      },
      "totalBalanceUSD": 0,
      "recommendation": "❌ Empty - skip this profile",
      "isCurrent": true
    },
    {
      "id": 12345678,
      "type": "business",
      "name": "Deploys Staff",
      "hasActivity": true,
      "activityCount": 156,
      "balances": {
        "USD": 33622.12,
        "PLN": 7534.59,
        "EUR": 0
      },
      "totalBalanceUSD": 33622.12,
      "recommendation": "✅ USE THIS ONE - Has both activity and balances",
      "isCurrent": false
    }
  ],
  "action": "Update WISE_PROFILE_ID environment variable to 12345678"
}
```

### Step 5: Update Railway Configuration

Once you identify the correct business profile ID:

1. Go to Railway Dashboard: https://railway.app
2. Navigate to your project
3. Click "Variables" tab
4. Find `WISE_PROFILE_ID`
5. Update value to the business profile ID (e.g., `12345678`)
6. Railway will automatically redeploy

### Step 6: Verify Fix

After Railway redeploys:

```bash
# Test connection
curl -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise-test/test-all

# Trigger sync
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise/sync

# Check Income tab in frontend
# Should now show transactions
```

## Troubleshooting

### Issue: "WISE_API_TOKEN is not set"
- Check Railway environment variables
- Verify token is actually set (not empty)

### Issue: "401 Unauthorized" from Wise API
- API token is invalid or expired
- Generate new token from Wise dashboard
- Update WISE_API_TOKEN in Railway

### Issue: "No profiles found"
- API token might be for wrong account
- Generate token from business account, not personal
- Check if token has "Read" permissions

### Issue: All profiles show 0 activity
- Token lacks required permissions
- Regenerate with full read access
- Or token is from sandbox account (use production token)

## Success Criteria

- ✅ `test-all-profiles` identifies business profile with activity
- ✅ Business profile ID is different from current (74801255)
- ✅ Business profile shows activity count > 0
- ✅ Business profile shows balances > $0
- ✅ After updating WISE_PROFILE_ID and re-sync:
  - Income tab shows transactions
  - Balances match Wise dashboard
  - Both income and expense entries appear

---

**Next**: After running these tests, update `WISE_ACCOUNT_CONNECTION_DEBUG.md` with findings.
