#!/usr/bin/env node

const https = require('https');

// Simulate a real Wise webhook payload
const testPayload = {
  event_type: 'balances#credit',
  schema_version: '2.0.0',
  sent_at: new Date().toISOString(),
  subscription_id: 'test-subscription-123',
  data: {
    resource: {
      id: 12345,
      type: 'balance-account',
      profile_id: 74801255
    },
    amount: 100.00,
    currency: 'EUR',
    occurred_at: new Date().toISOString(),
    transaction_type: 'credit',
    post_transaction_balance_amount: 1100.00
  }
};

const postData = JSON.stringify(testPayload);

const options = {
  hostname: 'business-accounting-system-production.up.railway.app',
  port: 443,
  path: '/api/wise/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Delivery-Id': 'test-delivery-' + Date.now(),
    'User-Agent': 'Wise-Webhook-Test/1.0'
  }
};

console.log('🧪 Testing Webhook Endpoint');
console.log('URL:', `https://${options.hostname}${options.path}`);
console.log('Payload:', JSON.stringify(testPayload, null, 2));
console.log('\n📤 Sending request...\n');

const req = https.request(options, (res) => {
  console.log(`✅ Response Status: ${res.statusCode} ${res.statusMessage}`);
  console.log('Response Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📥 Response Body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }

    if (res.statusCode === 200) {
      console.log('\n✅ SUCCESS: Webhook accepted!');
      console.log('\n👉 Check monitor: https://business-accounting-system-production.up.railway.app/webhook-monitor.html');
    } else {
      console.log('\n❌ FAILED: Webhook rejected!');
      console.log('Status:', res.statusCode);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request Error:', e.message);
});

req.write(postData);
req.end();
