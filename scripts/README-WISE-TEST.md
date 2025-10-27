# Wise API Diagnostic Test Script

## What This Does

Based on Wise support's feedback that **you don't need Partner API**, this script tests your Wise API access from scratch to find the exact issue.

According to Wise support (Sergio):
- ✅ Personal API tokens SHOULD work
- ❌ Error 403 is likely due to wrong profile ID, balance ID, or inactive currency
- ✅ You can create API tokens in Wise settings (no special access needed)

## What the Script Tests

1. **API Token Validity** - Is your token working?
2. **Your Profiles** - What profile IDs do you actually have?
3. **Your Balances** - What currencies are active? What are their balance IDs?
4. **Balance Statements** - Can you fetch transaction history?

## How to Run

### 1. Make Sure Your .env Has the Token

```bash
# backend/.env
WISE_API_TOKEN=your_api_token_here
WISE_PROFILE_ID=your_profile_id  # Optional - script will find it
WISE_API_BASE_URL=https://api.transferwise.com  # Optional
```

### 2. Run the Script

```bash
cd /Users/rafael/Windsurf/accounting
node scripts/test-wise-api-simple.js
```

## What to Expect

### If Your Token Works
```
✅ API token is valid!
ℹ️  User ID: 12345678
ℹ️  Email: your@email.com
```

### If You Have Wrong Profile ID
```
⚠️  WISE_PROFILE_ID (74801255) not found in your profiles!
💡 Using first profile: 74801125
```

### If Currency is Inactive
```
  Balance 2:
    Balance ID: 134500252
    Currency: EUR
    Amount: 1234.56 EUR
    Status: INACTIVE ❌
⚠️  This currency account is INACTIVE - API calls will fail!
```

### If Balance Statement Works
```
✅ Balance statement fetched successfully!
ℹ️  Transactions found: 255
```

### If You Get 403 Error
```
❌ Failed to fetch balance statement
❌ Status: 403
❌ x-2fa-approval-result: REJECTED

Possible causes (from Wise support):
  1. Balance ID doesn't belong to this profile
  2. Currency account is inactive/closed
  3. Wrong currency parameter
  4. This endpoint requires Strong Customer Authentication (SCA)
```

## What to Do Based on Results

### Scenario 1: Wrong Profile/Balance IDs
**Problem**: Script shows different IDs than you're using
**Solution**: Update your .env with correct IDs from script output

### Scenario 2: Inactive Currency
**Problem**: Currency shows `Status: INACTIVE`
**Solution**: Activate the currency in Wise dashboard first

### Scenario 3: SCA Required (x-2fa-approval-result: REJECTED)
**Problem**: Endpoint requires RSA signature
**Solution**: This is the original issue - we'll need to implement SCA properly

### Scenario 4: It Works!
**Problem**: No problem - your API access is fine!
**Solution**: You can proceed with full integration

## Next Steps

After running this script, you'll know:
1. ✅ If your token works
2. ✅ Your correct profile IDs and balance IDs
3. ✅ Which currencies are active
4. ✅ The exact error for balance statements

Share the output with me and we'll know exactly how to proceed!

## Troubleshooting

### "WISE_API_TOKEN not found"
Create or check your `backend/.env` file has the token

### "Cannot fetch profiles" (403)
Your API token may be expired - generate a new one:
https://wise.com/settings/api-tokens

### "No profiles found"
Your Wise account may not be verified/activated

## Support Reference

Wise support conversation:
- **Agent**: Sergio
- **Confirmation**: "You should be able to use the API without any special access from us"
- **Documentation**: https://docs.wise.com/api-docs
