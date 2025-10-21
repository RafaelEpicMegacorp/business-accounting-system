#!/usr/bin/env node

/**
 * Test Wise Webhook (No Signature Validation)
 *
 * Sends a test webhook with X-Test-Notification header to bypass signature validation.
 * This will show the full webhook logging output.
 */

const https = require('https');

const WEBHOOK_URL = 'https://business-accounting-system-production.up.railway.app/api/wise/webhook';

const payload = {
  event_type: 'balance-account-transactions#created',
  subscription_id: 'test-subscription-12345',
  sent_at: new Date().toISOString(),
  data: {
    resource: {
      type: 'DEBIT',
      id: Math.floor(Math.random() * 1000000),
      profile_id: 74801125,
      account_id: 130989121,
      amount: {
        value: -75.50,
        currency: 'USD'
      },
      status: 'COMPLETED',
      reference_number: `TEST-${Date.now()}`,
      date: new Date().toISOString(),
      description: 'Test webhook from simulator - Coffee shop purchase',
      merchant: {
        name: 'Starbucks #1234'
      }
    },
    occurred_at: new Date().toISOString()
  }
};

console.log('\n🧪 Testing Wise Webhook (Test Mode - No Signature Required)\n');
console.log('📦 Payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\n' + '─'.repeat(80) + '\n');

const urlObj = new URL(WEBHOOK_URL);
const payloadString = JSON.stringify(payload);

const options = {
  hostname: urlObj.hostname,
  port: 443,
  path: urlObj.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString),
    'User-Agent': 'Wise-Webhook-Test/1.0',
    'X-Test-Notification': 'true' // Bypass signature validation
  }
};

const req = https.request(options, (res) => {
  let body = '';

  console.log('📥 Response:', res.statusCode, res.statusMessage);

  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Body:', body || '(empty)');

    if (res.statusCode === 200) {
      console.log('\n✅ SUCCESS! Webhook was logged!');
      console.log('\n🔍 Now check Railway logs:');
      console.log('   https://railway.app/ → Your project → Logs');
      console.log('   Look for "WISE WEBHOOK RECEIVED"');
      console.log('\n   You should see:');
      console.log('   - Full headers');
      console.log('   - Complete payload');
      console.log('   - Transaction details: USD 75.50 from Starbucks\n');
    } else {
      console.log('\n❌ Unexpected response:', res.statusCode);
    }
  });
});

req.on('error', (err) => {
  console.error('\n❌ Error:', err.message);
});

req.write(payloadString);
req.end();
