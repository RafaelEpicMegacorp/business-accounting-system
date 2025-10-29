# Wise Profile Investigation Summary

**Date**: October 28, 2025
**Issue**: Income tab shows 0 entries despite business Wise account having many transactions
**Status**: ⏳ Investigation tools deployed - awaiting user testing

---

## Problem Statement

**User Report**: "There are a lot of transactions in the business account of Deploys Staff"

**System Behavior**:
- API returns 0 activities for profile 74801255
- All currency balances show $0
- Income tab is empty

**Hypothesis**: System is connected to **wrong Wise profile** (personal account instead of business account)

---

## Investigation Completed

### What I Discovered

1. **Wise Account is Empty** (via API):
   - Profile 74801255 returns 0 activities
   - All balances (USD, PLN, EUR) are $0
   - No transactions in last 2 years

2. **Dashboard Shows $35,692**:
   - This is from local `currency_balances` database table
   - NOT from real Wise account
   - Data is stale or from old CSV import

3. **Likely Root Cause**:
   - Profile 74801255 is personal account (empty)
   - Business profile "Deploys Staff" has different ID
   - Need to find correct business profile ID and update Railway config

---

## Solution Deployed

### New Debug Endpoints (Live in Production)

I've deployed 4 new endpoints to help diagnose and fix this:

#### 1. Check Current Configuration
```
GET /api/wise/debug/current-config
```
Shows current WISE_PROFILE_ID and token status

#### 2. List All Profiles
```
GET /api/wise/debug/list-profiles
```
Lists all Wise profiles accessible with current token
- Identifies personal vs business accounts
- Shows profile names and IDs

#### 3. Test Specific Profile
```
GET /api/wise/debug/test-profile/{profileId}
```
Tests a specific profile for:
- Activity count (transactions)
- Currency balances
- Transaction history
- Recommends if it should be used

#### 4. Test All Profiles (⭐ RECOMMENDED)
```
GET /api/wise/debug/test-all-profiles
```
**This is the best one to use** - it:
- Tests every profile automatically
- Shows activity count for each
- Shows balances for each
- Recommends which profile to use
- Tells you exactly what to update in Railway

---

## Next Steps for You

### Step 1: Run Test All Profiles Endpoint

**📖 Full instructions**: See [TEST_WISE_PROFILES.md](./TEST_WISE_PROFILES.md)

**Quick version**:

1. **Login to get JWT token**:
```bash
curl -X POST https://business-accounting-system-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rafael","password":"asdflkj@3!"}'
```

2. **Test all profiles** (copy token from step 1):
```bash
TOKEN="<your-token-here>"

curl -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise/debug/test-all-profiles
```

3. **Look for**:
   - Profile with `type: "business"`
   - Profile with `hasActivity: true`
   - Profile with `activityCount > 0`
   - Profile with `balances` showing your $35k+
   - Recommendation: `"✅ USE THIS ONE"`

### Step 2: Update Railway Configuration

Once you identify the correct business profile ID:

1. Go to Railway: https://railway.app
2. Navigate to your project
3. Click "Variables" tab
4. Find `WISE_PROFILE_ID`
5. Update to the business profile ID (e.g., if test shows profile 12345678)
6. Save (Railway auto-redeploys)

### Step 3: Verify Fix

After Railway redeploys (takes ~2 minutes):

1. **Test connection**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise-test/test-all
```

2. **Trigger sync**:
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://business-accounting-system-production.up.railway.app/api/wise/sync
```

3. **Check frontend**:
   - Go to https://ds-accounting.netlify.app
   - Login
   - Click "Income" tab
   - Should now show transactions! 🎉

---

## Expected Results After Fix

### Before Fix:
- ❌ Income tab: 0 entries
- ❌ Activities API: 0 transactions
- ❌ Balances API: All $0
- ✅ Dashboard widget: $35,692 (from stale database)

### After Fix:
- ✅ Income tab: Shows all income transactions from Wise
- ✅ Activities API: Returns real transactions (100+)
- ✅ Balances API: Shows real balances ($35k+)
- ✅ Dashboard widget: Matches real Wise account
- ✅ Both income AND expense entries visible

---

## Troubleshooting

### If test-all-profiles shows 0 for all profiles:

**Possible causes**:
1. API token is from wrong Wise account
2. API token lacks read permissions
3. Token is expired

**Solution**:
1. Go to wise.com (business account)
2. Settings → API tokens
3. Create new token with "Read" permissions
4. Update `WISE_API_TOKEN` in Railway
5. Run test-all-profiles again

### If all profiles are type "personal":

**Problem**: Token is from personal Wise account

**Solution**:
1. Login to Wise business account (not personal)
2. Generate API token from business account
3. Update `WISE_API_TOKEN` in Railway
4. Run test-all-profiles again

---

## Documentation References

- **[WISE_ACCOUNT_CONNECTION_DEBUG.md](./WISE_ACCOUNT_CONNECTION_DEBUG.md)** - Complete investigation guide
- **[TEST_WISE_PROFILES.md](./TEST_WISE_PROFILES.md)** - Step-by-step testing instructions
- **[INVESTIGATION_INCOME_TAB_EMPTY.md](./INVESTIGATION_INCOME_TAB_EMPTY.md)** - Technical analysis

---

## Files Modified

### Backend Code:
- `backend/src/routes/wiseDebug.js` (NEW) - Debug endpoints
- `backend/src/server.js` - Registered debug routes

### Documentation:
- `WISE_ACCOUNT_CONNECTION_DEBUG.md` (NEW) - Investigation guide
- `TEST_WISE_PROFILES.md` (NEW) - Testing instructions
- `WISE_PROFILE_INVESTIGATION_SUMMARY.md` (NEW) - This file
- `INVESTIGATION_INCOME_TAB_EMPTY.md` (NEW) - Technical analysis

### Git:
```bash
commit f4fc6cd
"Add Wise profile debugging endpoints to identify correct business account"
```

---

## Success Criteria

- [x] Debug endpoints deployed to production
- [x] Documentation created
- [ ] User runs test-all-profiles endpoint ← **YOU ARE HERE**
- [ ] Correct business profile ID identified
- [ ] WISE_PROFILE_ID updated in Railway
- [ ] Re-sync completes successfully
- [ ] Income tab shows transactions
- [ ] Both income and expense entries visible
- [ ] Balances match Wise dashboard

---

## What I Need From You

1. **Run the test-all-profiles endpoint** (see Step 1 above)
2. **Share the response** so I can see which profile is the business account
3. I'll tell you exactly which profile ID to use
4. Then you update Railway and we verify it works

---

**Status**: ⏳ Waiting for user to run test-all-profiles endpoint

**ETA to Fix**: 5 minutes after identifying correct profile ID
