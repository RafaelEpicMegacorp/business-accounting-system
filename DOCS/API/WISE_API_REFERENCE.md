# Wise API Reference

Essential Wise API endpoints for accounting system integration.

**Official Documentation**: https://docs.wise.com/api-docs/api-reference/
**Sandbox Base URL**: `https://api.sandbox.wise.com`
**Production Base URL**: `https://api.wise.com`

**Authentication**: Bearer token (API token or OAuth)
**Content-Type**: `application/json`

---

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Profile Management](#profile-management)
- [Balance Management](#balance-management)
- [Balance Statements](#balance-statements)
- [Webhooks](#webhooks)
- [Common Use Cases](#common-use-cases)

---

## Getting Started

### API Environments

**Sandbox (Testing)**:
```
Base URL: https://api.sandbox.wise.com
Purpose: Testing and development
API Token: Test credentials from Wise support
```

**Production**:
```
Base URL: https://api.wise.com
Purpose: Live transactions
API Token: Production credentials (requires verification)
```

### Required Headers

```http
Authorization: Bearer <your-api-token>
Content-Type: application/json
X-idempotence-uuid: <generated-uuid>  # For POST requests
```

### Idempotency

For POST requests that modify data, include `X-idempotence-uuid` header with a UUID:
- Prevents duplicate operations on retry
- Same UUID = same operation (safe to retry)
- Required for balance conversions and transfers

---

## Authentication

### Strong Customer Authentication (SCA)

Some endpoints require additional authentication when used by profiles registered in UK/EEA:

**SCA Protected Endpoints:**
- Balance statements
- Transfer creation
- Recipient account creation

**Learn More**: https://docs.wise.com/api-docs/guides/strong-customer-authentication-2fa

### API Token Types

1. **Personal Token**: For individual account access
2. **OAuth Token**: For third-party application access
3. **Client Credentials**: For application-level access

**For This Project**: Use Personal API Token (simplest for own account)

---

## Profile Management

### Get User Profiles

**Endpoint**: `GET /v1/profiles` ⚠️ **Note**: Use v1, not v2

Retrieve all profiles associated with your account.

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v1/profiles" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:**
```json
[
  {
    "id": 12345678,
    "type": "personal",
    "details": {
      "firstName": "Rafael",
      "lastName": "User",
      "dateOfBirth": "1990-01-01",
      "phoneNumber": "+1234567890"
    }
  }
]
```

**Use Case**: Get `profileId` needed for other API calls.

**Official Docs**: https://docs.wise.com/api-docs/api-reference/profile

---

## Balance Management

### List Balances for Profile

**Endpoint**: `GET /v4/profiles/{{profileId}}/balances?types=STANDARD`

Get all currency balances for a profile.

**Query Parameters:**
- `types` (required): `STANDARD` or `SAVINGS` (comma-separated for multiple)

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v4/profiles/12345678/balances?types=STANDARD" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:**
```json
[
  {
    "id": 200001,
    "currency": "EUR",
    "type": "STANDARD",
    "name": null,
    "icon": null,
    "investmentState": "NOT_INVESTED",
    "amount": {
      "value": 1250.50,
      "currency": "EUR"
    },
    "reservedAmount": {
      "value": 0,
      "currency": "EUR"
    },
    "cashAmount": {
      "value": 1250.50,
      "currency": "EUR"
    },
    "totalWorth": {
      "value": 1250.50,
      "currency": "EUR"
    },
    "creationTime": "2024-01-15T10:00:00Z",
    "modificationTime": "2025-01-20T08:30:00Z",
    "visible": true
  },
  {
    "id": 200002,
    "currency": "USD",
    "type": "STANDARD",
    "amount": {
      "value": 5000.00,
      "currency": "USD"
    },
    ...
  }
]
```

**Use Case**: Get current balances for all currencies in your account.

**Official Docs**: https://docs.wise.com/api-docs/api-reference/balance#list

---

### Get Balance by ID

**Endpoint**: `GET /v4/profiles/{{profileId}}/balances/{{balanceId}}`

Get specific balance details.

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v4/profiles/12345678/balances/200001" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:** Single balance object (same structure as above)

**Use Case**: Check specific currency balance.

**Official Docs**: https://docs.wise.com/api-docs/api-reference/balance#get

---

### Create Balance Account

**Endpoint**: `POST /v4/profiles/{{profileId}}/balances`

Open new currency balance (multi-currency account).

**Request:**
```bash
curl -X POST "https://api.sandbox.wise.com/v4/profiles/12345678/balances" \
  -H "Authorization: Bearer <your-api-token>" \
  -H "Content-Type: application/json" \
  -H "X-idempotence-uuid: $(uuidgen)" \
  -d '{
    "currency": "GBP",
    "type": "STANDARD"
  }'
```

**Request Body:**
```json
{
  "currency": "GBP",
  "type": "STANDARD"
}
```

**Response:** Balance object for newly created account

**Use Case**: Add new currency to your multi-currency account.

**Official Docs**: https://docs.wise.com/api-docs/api-reference/balance#create

---

### Convert Across Balance Accounts

**Endpoint**: `POST /v2/profiles/{{profileId}}/balance-movements`

Convert money between different currency balances.

**Prerequisites:**
1. Create quote with `"payOut": "BALANCE"`
2. Use quote ID in conversion request

**Request:**
```bash
curl -X POST "https://api.sandbox.wise.com/v2/profiles/12345678/balance-movements" \
  -H "Authorization: Bearer <your-api-token>" \
  -H "Content-Type: application/json" \
  -H "X-idempotence-uuid: $(uuidgen)" \
  -d '{
    "quoteId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

**Response:**
```json
{
  "id": 30000001,
  "type": "CONVERSION",
  "state": "COMPLETED",
  "balancesAfter": [
    {
      "id": 200001,
      "value": 1137.02,
      "currency": "EUR"
    },
    {
      "id": 200002,
      "value": 5100.00,
      "currency": "USD"
    }
  ],
  "sourceAmount": {
    "value": 113.48,
    "currency": "EUR"
  },
  "targetAmount": {
    "value": 100.00,
    "currency": "USD"
  },
  "rate": 0.88558,
  "feeAmounts": [
    {
      "value": 0.56,
      "currency": "EUR"
    }
  ],
  "creationTime": "2025-01-20T10:15:30Z"
}
```

**Use Case**: Exchange currencies within your account (e.g., EUR → USD).

**Official Docs**: https://docs.wise.com/api-docs/api-reference/balance#convert

---

### Get Total Funds

**Endpoint**: `GET /v1/profiles/{{profileId}}/total-funds/{currency}`

Get total balance across all currencies, converted to specified currency.

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v1/profiles/12345678/total-funds/USD" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:**
```json
{
  "totalWorth": {
    "value": 75000.00,
    "currency": "USD"
  },
  "totalAvailable": {
    "value": 75000.00,
    "currency": "USD"
  },
  "overdraft": {
    "available": {
      "value": 0.00,
      "currency": "USD"
    },
    "limit": {
      "value": 0.00,
      "currency": "USD"
    },
    "used": {
      "value": 0.00,
      "currency": "USD"
    },
    "availableByCurrency": []
  }
}
```

**Use Case**: Get total account value in single currency.

**Official Docs**: https://docs.wise.com/api-docs/api-reference/balance#total-funds

---

### Get Balance Capacity

**Endpoint**: `GET /v1/profiles/{{profileId}}/balance-capacity?currency={currency}`

Check deposit limits for regulatory compliance (mainly for Singapore/Malaysia).

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v1/profiles/12345678/balance-capacity?currency=SGD" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:**
```json
{
  "hasLimit": true,
  "depositLimit": {
    "amount": 2000.00,
    "currency": "SGD"
  }
}
```

**Use Case**: Check if account can accept deposits (regulatory limits).

**Official Docs**: https://docs.wise.com/api-docs/api-reference/balance#capacity

---

## Balance Statements

### Get Balance Statement

**Endpoint**: `GET /v1/profiles/{{profileId}}/balance-statements/{{balanceId}}/statement.json`

Retrieve transaction history for specific balance.

**Query Parameters:**
- `currency` (required): Currency code (e.g., EUR, USD)
- `intervalStart` (required): Start date (ISO 8601, e.g., `2025-01-01T00:00:00.000Z`)
- `intervalEnd` (required): End date (ISO 8601, e.g., `2025-01-31T23:59:59.999Z`)
- `type` (required): `COMPACT` or `FLAT`

**Max Interval**: 469 days (~1 year 3 months)

**Format Options**:
- `.json` - JSON format
- `.csv` - CSV format
- `.pdf` - PDF with Wise branding
- `.xlsx` - Excel format
- `.xml` - CAMT.053 format
- `.mt940` - MT940 format
- `.qif` - QIF format

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v1/profiles/12345678/balance-statements/200001/statement.json?currency=EUR&intervalStart=2025-01-01T00:00:00.000Z&intervalEnd=2025-01-31T23:59:59.999Z&type=COMPACT" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:**
```json
{
  "accountHolder": {
    "type": "PERSONAL",
    "address": {
      "addressFirstLine": "123 Main St",
      "city": "London",
      "postCode": "E1 6JJ",
      "countryName": "United Kingdom"
    },
    "firstName": "Rafael",
    "lastName": "User"
  },
  "issuer": {
    "name": "Wise Payments Limited",
    "firstLine": "56 Shoreditch High Street",
    "city": "London",
    "postCode": "E1 6JJ",
    "country": "United Kingdom"
  },
  "transactions": [
    {
      "type": "CREDIT",
      "date": "2025-01-15T10:30:00Z",
      "amount": {
        "value": 1000.00,
        "currency": "EUR"
      },
      "totalFees": {
        "value": 0.00,
        "currency": "EUR"
      },
      "details": {
        "type": "DEPOSIT",
        "description": "Received money from John Doe",
        "senderName": "John Doe",
        "senderAccount": "GB29 NWBK 6016 1331 9268 19",
        "paymentReference": "Invoice #123"
      },
      "exchangeDetails": null,
      "runningBalance": {
        "value": 1250.50,
        "currency": "EUR"
      },
      "referenceNumber": "TRANSFER-12345678"
    },
    {
      "type": "DEBIT",
      "date": "2025-01-18T14:20:00Z",
      "amount": {
        "value": -50.00,
        "currency": "EUR"
      },
      "totalFees": {
        "value": 2.50,
        "currency": "EUR"
      },
      "details": {
        "type": "TRANSFER",
        "description": "Sent money to Jane Smith",
        "recipientName": "Jane Smith"
      },
      "runningBalance": {
        "value": 1200.50,
        "currency": "EUR"
      },
      "referenceNumber": "TRANSFER-12345679"
    }
  ],
  "endOfStatementBalance": {
    "value": 1250.50,
    "currency": "EUR"
  },
  "query": {
    "intervalStart": "2025-01-01T00:00:00Z",
    "intervalEnd": "2025-01-31T23:59:59.999Z",
    "currency": "EUR",
    "accountId": 200001
  }
}
```

**Transaction Types:**
- `DEPOSIT` - Incoming bank transfer
- `TRANSFER` - Outgoing transfer
- `CONVERSION` - Currency exchange
- `CARD` - Card payment
- `MONEY_ADDED` - Manual top-up
- `BALANCE_INTEREST` - Interest earned
- `BALANCE_ADJUSTMENT` - Account adjustment

**Use Case**:
- Import transaction history for accounting
- Replace CSV manual export workflow
- Automate transaction sync

**SCA Note**: Requires SCA authentication every 90 days (UK/EEA profiles).

**Official Docs**: https://docs.wise.com/api-docs/api-reference/balance-statement

---

## Webhooks

Webhooks enable real-time notifications for account events.

### Create Profile Webhook Subscription

**Endpoint**: `POST /v3/profiles/{{profileId}}/subscriptions`

Subscribe to events for specific profile.

**Request:**
```bash
curl -X POST "https://api.sandbox.wise.com/v3/profiles/12345678/subscriptions" \
  -H "Authorization: Bearer <your-api-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Transaction Notifications",
    "trigger_on": "balances#credit",
    "delivery": {
      "version": "2.0.0",
      "url": "https://your-server.com/webhook/wise"
    }
  }'
```

**Request Body:**
```json
{
  "name": "Transaction Notifications",
  "trigger_on": "balances#credit",
  "delivery": {
    "version": "2.0.0",
    "url": "https://your-server.com/webhook/wise"
  }
}
```

**Event Types:**
- `balances#credit` - Money received
- `balances#update` - Balance updated
- `transfers#state-change` - Transfer status changed
- `transfers#active-cases` - Transfer has issues

**Full Event List**: https://docs.wise.com/api-docs/webhooks-notifications/event-types

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Transaction Notifications",
  "delivery": {
    "version": "2.0.0",
    "url": "https://your-server.com/webhook/wise"
  },
  "trigger_on": "balances#credit",
  "scope": {
    "domain": "profile",
    "id": "12345678"
  },
  "created_by": {
    "type": "user",
    "id": "87654321"
  },
  "created_at": "2025-01-20T10:00:00Z"
}
```

**Use Case**: Get notified when money arrives (for automatic transaction sync).

**Official Docs**: https://docs.wise.com/api-docs/api-reference/webhook#create-profile

---

### List Profile Webhooks

**Endpoint**: `GET /v3/profiles/{{profileId}}/subscriptions`

Get all webhook subscriptions for profile.

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v3/profiles/12345678/subscriptions" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:** Array of subscription objects

**Official Docs**: https://docs.wise.com/api-docs/api-reference/webhook#list-profile

---

### Get Webhook Subscription

**Endpoint**: `GET /v3/profiles/{{profileId}}/subscriptions/{{subscriptionId}}`

Get specific webhook subscription.

**Request:**
```bash
curl -X GET "https://api.sandbox.wise.com/v3/profiles/12345678/subscriptions/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:** Single subscription object

**Official Docs**: https://docs.wise.com/api-docs/api-reference/webhook#get-profile

---

### Delete Webhook Subscription

**Endpoint**: `DELETE /v3/profiles/{{profileId}}/subscriptions/{{subscriptionId}}`

Remove webhook subscription.

**Request:**
```bash
curl -X DELETE "https://api.sandbox.wise.com/v3/profiles/12345678/subscriptions/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer <your-api-token>"
```

**Response:** 204 No Content

**Official Docs**: https://docs.wise.com/api-docs/api-reference/webhook#delete-profile

---

### Webhook Payload Structure

When an event triggers, Wise sends POST request to your webhook URL:

**Headers:**
```
X-Signature: <signature>
X-Delivery-Id: <delivery-id>
X-Test-Notification: false
Content-Type: application/json
```

**Body:**
```json
{
  "data": {
    "resource": {
      "id": 200001,
      "type": "balance",
      "profile_id": 12345678
    },
    "amount": 1000.00,
    "currency": "EUR",
    "transaction_type": "deposit",
    "occurred_at": "2025-01-20T10:30:00Z"
  },
  "subscription_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event_type": "balances#credit",
  "schema_version": "2.0.0",
  "sent_at": "2025-01-20T10:30:05Z"
}
```

**Signature Verification**: Verify `X-Signature` header to ensure authenticity.

**Official Docs**: https://docs.wise.com/api-docs/webhooks-notifications/event-handling

---

## Common Use Cases

### Use Case 1: Sync Account Balances

**Goal**: Get current balance for all currencies.

**Steps:**
1. Get profile ID: `GET /v1/profiles`
2. List balances: `GET /v4/profiles/{profileId}/balances?types=STANDARD`
3. Store balance data in your database

**Frequency**: Every hour or on-demand

**Code Example:**
```javascript
// Get balances
const response = await fetch(
  `https://api.wise.com/v4/profiles/${profileId}/balances?types=STANDARD`,
  {
    headers: {
      'Authorization': `Bearer ${apiToken}`
    }
  }
);
const balances = await response.json();

// Store in database
for (const balance of balances) {
  await updateCurrencyBalance(balance.currency, balance.amount.value);
}
```

---

### Use Case 2: Import Transaction History

**Goal**: Import monthly transactions from Wise.

**Steps:**
1. Get balance ID: `GET /v4/profiles/{profileId}/balances?types=STANDARD`
2. For each balance, get statement:
   ```
   GET /v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json
   ?currency=EUR
   &intervalStart=2025-01-01T00:00:00.000Z
   &intervalEnd=2025-01-31T23:59:59.999Z
   &type=COMPACT
   ```
3. Parse transactions and create entries in your database

**Frequency**: Monthly or on-demand

**Code Example:**
```javascript
// Get statement
const startDate = '2025-01-01T00:00:00.000Z';
const endDate = '2025-01-31T23:59:59.999Z';

const response = await fetch(
  `https://api.wise.com/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json?currency=EUR&intervalStart=${startDate}&intervalEnd=${endDate}&type=COMPACT`,
  {
    headers: {
      'Authorization': `Bearer ${apiToken}`
    }
  }
);
const statement = await response.json();

// Process transactions
for (const tx of statement.transactions) {
  const type = tx.type === 'CREDIT' ? 'income' : 'expense';
  const amount = Math.abs(tx.amount.value);

  await createEntry({
    type,
    category: classifyTransaction(tx.details.type),
    description: tx.details.description,
    amount,
    currency: tx.amount.currency,
    entry_date: tx.date,
    wise_reference: tx.referenceNumber
  });
}
```

---

### Use Case 3: Real-Time Transaction Sync with Webhooks

**Goal**: Automatically import transactions when money arrives.

**Steps:**
1. Create webhook subscription:
   ```
   POST /v3/profiles/{profileId}/subscriptions
   {
     "name": "Transaction Sync",
     "trigger_on": "balances#credit",
     "delivery": {
       "version": "2.0.0",
       "url": "https://your-server.com/api/webhooks/wise"
     }
   }
   ```

2. Implement webhook endpoint:
   ```javascript
   // POST /api/webhooks/wise
   app.post('/api/webhooks/wise', async (req, res) => {
     // Verify signature
     const signature = req.headers['x-signature'];
     if (!verifyWiseSignature(req.body, signature)) {
       return res.status(401).send('Invalid signature');
     }

     // Process event
     const event = req.body;
     if (event.event_type === 'balances#credit') {
       // Fetch full transaction details
       const statement = await getBalanceStatement(
         event.data.resource.id,
         event.data.occurred_at
       );

       // Import transaction
       await importTransaction(statement);
     }

     res.status(200).send('OK');
   });
   ```

3. Acknowledge webhook: Return 200 OK within 5 seconds

**Benefits**:
- Near real-time transaction sync
- No polling required
- Reduced API calls

---

### Use Case 4: Multi-Currency Conversion

**Goal**: Exchange EUR to USD within Wise account.

**Steps:**
1. Create quote:
   ```
   POST /v3/profiles/{profileId}/quotes
   {
     "sourceCurrency": "EUR",
     "targetCurrency": "USD",
     "sourceAmount": 100.00,
     "payOut": "BALANCE"
   }
   ```

2. Convert using quote:
   ```
   POST /v2/profiles/{profileId}/balance-movements
   {
     "quoteId": "quote-uuid"
   }
   ```

3. Verify conversion completed

**Code Example:**
```javascript
// Create quote
const quoteResponse = await fetch(
  `https://api.wise.com/v3/profiles/${profileId}/quotes`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      sourceAmount: 100.00,
      payOut: 'BALANCE'
    })
  }
);
const quote = await quoteResponse.json();

// Execute conversion
const conversionResponse = await fetch(
  `https://api.wise.com/v2/profiles/${profileId}/balance-movements`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'X-idempotence-uuid': generateUUID()
    },
    body: JSON.stringify({
      quoteId: quote.id
    })
  }
);
const conversion = await conversionResponse.json();
```

---

## Error Handling

### Common Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Verify API token |
| 403 | Forbidden | Check permissions/SCA |
| 404 | Not Found | Verify resource ID |
| 429 | Rate Limited | Implement backoff strategy |
| 500 | Server Error | Retry with exponential backoff |

### Error Response Format

```json
{
  "error": "invalid_request",
  "error_description": "The request is missing the 'currency' parameter",
  "timestamp": "2025-01-20T10:00:00Z",
  "path": "/v4/profiles/12345678/balances",
  "trace_id": "a1b2c3d4e5f6"
}
```

### Retry Strategy

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Rate Limiting

**Current Limits** (as of 2025):
- 100 requests per minute per API token
- 1000 requests per hour per API token

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642684800
```

**Best Practices:**
- Implement exponential backoff on 429 errors
- Cache frequently accessed data
- Use webhooks instead of polling
- Batch operations when possible

---

## Security Best Practices

1. **Store API Token Securely**
   - Use environment variables
   - Never commit to version control
   - Rotate tokens regularly

2. **Verify Webhook Signatures**
   - Always validate `X-Signature` header
   - Use HTTPS for webhook endpoints
   - Implement replay attack protection

3. **Use Idempotency Keys**
   - Generate unique UUIDs for POST requests
   - Store keys to prevent duplicates
   - Safe retry logic

4. **Implement SCA Flow**
   - Handle SCA challenges gracefully
   - Store SCA approval timestamps
   - Re-authenticate every 90 days

---

## Testing in Sandbox

**Sandbox Features:**
- Free to use
- Simulated transactions
- No real money involved
- Same API structure as production

**Sandbox Limitations:**
- Cannot receive real bank transfers
- Limited balance statement history
- Simulated exchange rates

**Getting Sandbox Access:**
1. Sign up at https://sandbox.wise.com
2. Generate API token from settings
3. Use sandbox base URL for all requests

---

## Migration from CSV Import to API

**Current State**: Manual CSV export → upload → import

**Future State**: Automated API sync

**Migration Steps:**

1. **Phase 1**: Parallel operation
   - Keep CSV import working
   - Add API sync as alternative
   - Validate API results against CSV

2. **Phase 2**: Gradual transition
   - Use API for new transactions
   - CSV for historical backfill
   - Monitor for issues

3. **Phase 3**: Full API integration
   - Disable CSV import
   - Real-time webhook sync
   - Scheduled statement pulls

**Benefits:**
- No manual exports
- Near real-time updates
- Better data consistency
- Reduced manual work

---

## Related Documentation

- [Internal API Reference](INTERNAL_API.md) - Your backend API
- [Quick Reference](API_QUICK_REFERENCE.md) - Fast lookup
- [Official Wise Docs](https://docs.wise.com/api-docs/api-reference/) - Complete API reference

---

## Support & Resources

**Official Resources:**
- API Documentation: https://docs.wise.com/api-docs/
- API Status: https://status.wise.com/
- Support: https://wise.com/help/
- Community Forum: https://community.wise.com/

**For This Project:**
- Freelancer is implementing full API integration
- Current CSV import is temporary solution
- See `freelancer-solution/` for API implementation status

---

**Last Updated:** 2025-10-27
**Wise API Version:** v4 (Balances), v3 (Webhooks), v1 (Statements)
**Key Endpoints Documented:** 15+
