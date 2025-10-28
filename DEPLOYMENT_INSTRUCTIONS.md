# Wise Integration Fix - Deployment Instructions

**Date**: October 28, 2025
**Status**: ✅ Code committed and ready to deploy

## What Was Fixed

✅ **Removed confidence scoring system** - No more "25% confidence" nonsense
✅ **Preserved original currencies** - Show "7930 PLN" not "$1,500 USD"
✅ **Real merchant names** - From Wise API, no "Wise test" placeholders
✅ **Complete 2-year history** - Fetch ALL transactions, not just recent
✅ **All status = completed** - Wise transactions are historical facts

**Code Changes**: -96 lines (simpler, faster, more reliable)

## Quick Deployment (3 Steps)

### Step 1: Push to Production ⏱️ 2 minutes

```bash
# Push to live branch (auto-deploys to Railway)
git push origin live
```

**What happens**:
- Railway detects push to `live` branch
- Backend rebuilds automatically (~2 min)
- Frontend (Netlify) unchanged (no code changes needed)

**Verify deployment**:
- Check Railway dashboard: https://railway.app
- Wait for "Deployed" status
- Health check: https://business-accounting-system-production.up.railway.app/health

### Step 2: Clean Up Test Data ⏱️ 1 minute

**Option A: Quick Command** (if you have database URL handy)
```bash
DATABASE_URL="postgresql://postgres:iiijaeSBDPUckvGWSopVfrJmvlpNzmDp@gondola.proxy.rlwy.net:41656/railway" \
  node backend/scripts/cleanup-wise-test-data.js
```

**Option B: Via Railway CLI**
```bash
# Install Railway CLI (one-time)
npm install -g @railway/cli

# Run cleanup
railway run node backend/scripts/cleanup-wise-test-data.js
```

**Expected Output**:
```
🧹 Wise Test Data Cleanup
=========================
   ✅ Deleted 5 entries
   ✅ Deleted 5 wise_transactions
   ✅ Currency balances recalculated
✅ Cleanup complete! Ready for fresh Wise sync.
```

### Step 3: Re-Sync Wise Data ⏱️ 30-60 seconds

1. Open: https://ds-accounting.netlify.app
2. Login: `rafael` / `asdflkj@3!`
3. Click **"Sync Wise"** button on dashboard
4. Wait for completion message

**Expected Result**:
```
✅ Sync complete
- 127 transactions imported
- 127 entries created
- 0 errors
```

## Verification (What to Check)

### ✅ Must See
- [ ] **Real merchant names** (not "Wise test - Office supplies")
- [ ] **Original currencies** ("7930.00 PLN", "50.00 EUR")
- [ ] **All status = Completed** (green checkmarks)
- [ ] **No confidence %** anywhere in UI or detail field
- [ ] **Both income and expense tabs** populated with data

### ❌ Must NOT See
- [ ] "Wise test" in any description
- [ ] USD amounts when transaction was in PLN/EUR
- [ ] "Confidence: 25%" or any confidence percentage
- [ ] "Pending" status on Wise entries
- [ ] Empty income/expense tabs

## If Something Goes Wrong

### Rollback (< 5 minutes)
```bash
# Revert to previous version
git revert HEAD
git push origin live

# Railway auto-deploys old version
# Wait 2 minutes, then re-sync
```

### Re-Sync Issues
If sync fails or data looks wrong:

1. **Check Railway logs**: https://railway.app → Deployments → View Logs
2. **Verify environment variables**: WISE_API_TOKEN, WISE_PROFILE_ID
3. **Re-run cleanup**: `railway run node backend/scripts/cleanup-wise-test-data.js`
4. **Try sync again**: Click "Sync Wise" button

### Database Query (Check Data)
```bash
railway run psql $DATABASE_URL

-- Check recent Wise entries
SELECT id, description, currency, amount_original, status, detail
FROM entries
WHERE detail LIKE '%Imported from Wise%'
ORDER BY created_at DESC
LIMIT 10;

-- Verify no confidence scores
SELECT COUNT(*) FROM entries WHERE detail LIKE '%Confidence%';
-- Should return: 0
```

## Expected Timeline

| Step | Duration | Status |
|------|----------|--------|
| Push to Railway | 2 min | Auto-deploy |
| Clean up test data | 1 min | Manual script |
| Re-sync Wise | 30-60 sec | Manual button |
| **Total** | **~4 minutes** | **End-to-end** |

## What Changed in Code

### Removed (96 lines)
- ❌ wiseClassifier.js import
- ❌ confidence scoring logic
- ❌ USD conversion API calls
- ❌ Complex threshold checks (40%, 20%)
- ❌ "Pending review" workflow
- ❌ autoCreateEntry() function

### Added/Simplified (30 lines)
- ✅ Direct entry creation (no classification)
- ✅ Original currency preservation
- ✅ 2-year date range for Activities API
- ✅ Single code path (CREDIT→income, DEBIT→expense)
- ✅ All status = 'completed'
- ✅ Clean detail field (no confidence %)

## Need Help?

### Documentation
- **Full Summary**: `WISE_INTEGRATION_OVERHAUL_SUMMARY.md`
- **Wise API Docs**: `/DOCS/API/WISE_API_REFERENCE.md`
- **Previous Fixes**: `WISE_DATA_FIX_SUMMARY.md`

### Quick Checks
- **Health**: https://business-accounting-system-production.up.railway.app/health
- **Railway Dashboard**: https://railway.app
- **Frontend**: https://ds-accounting.netlify.app

---

**Status**: ✅ Ready to Deploy
**Risk**: Low (reversible, cleanup script tested)
**Downtime**: Zero (no service interruption)
**Rollback**: < 5 minutes if needed
