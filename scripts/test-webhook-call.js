#!/usr/bin/env node

/**
 * Test Wise Webhook Call
 *
 * Simulates Wise calling your webhook endpoint with test data.
 * Use this to verify webhook logging and processing without waiting for real Wise events.
 *
 * Usage:
 *   node scripts/test-webhook-call.js
 */

const https = require('https');

const WEBHOOK_URL = 'https://business-accounting-system-production.up.railway.app/api/wise/webhook';

// Sample webhook payloads for different event types
const TEST_PAYLOADS = {
  transaction_created: {
    event_type: 'balance-account-transactions#created',
    subscription_id: 'test-subscription-12345',
    sent_at: new Date().toISOString(),
    data: {
      resource: {
        type: 'balance-account-transaction',
        id: Math.floor(Math.random() * 1000000),
        profile_id: 74801125,
        account_id: 130989121,
        amount: {
          value: -50.00,
          currency: 'USD'
        },
        type: 'DEBIT',
        status: 'COMPLETED',
        reference_number: `TEST-${Date.now()}`,
        date: new Date().toISOString(),
        description: 'Test transaction from webhook simulator',
        merchant: {
          name: 'Test Merchant Co.'
        }
      },
      occurred_at: new Date().toISOString()
    }
  },

  transfer_state_change: {
    event_type: 'transfers#state-change',
    subscription_id: 'test-subscription-12345',
    sent_at: new Date().toISOString(),
    data: {
      resource: {
        type: 'transfer',
        id: Math.floor(Math.random() * 1000000),
        profile_id: 74801125,
        account_id: 130989121,
        status: 'outgoing_payment_sent'
      },
      current_state: 'outgoing_payment_sent',
      previous_state: 'processing',
      occurred_at: new Date().toISOString()
    }
  },

  test_event: {
    event_type: 'test',
    subscription_id: 'test-subscription-12345',
    sent_at: new Date().toISOString(),
    data: {
      resource: {
        type: 'test',
        id: 0
      }
    }
  }
};

console.log('\n╔' + '═'.repeat(78) + '╗');
console.log('║' + ' '.repeat(24) + 'WISE WEBHOOK TESTER' + ' '.repeat(33) + '║');
console.log('╚' + '═'.repeat(78) + '╝\n');

console.log('🎯 Target URL:', WEBHOOK_URL);
console.log('📋 Available test payloads:\n');
console.log('  1. transaction_created - Simulate new transaction');
console.log('  2. transfer_state_change - Simulate transfer status change');
console.log('  3. test_event - Simulate Wise test event\n');

// Choose payload (default to transaction_created)
const payloadType = process.argv[2] || 'transaction_created';
const payload = TEST_PAYLOADS[payloadType] || TEST_PAYLOADS.transaction_created;

console.log(`📦 Using payload type: ${payloadType}\n`);
console.log('─'.repeat(80) + '\n');

// Send webhook request
function sendWebhook() {
  const urlObj = new URL(WEBHOOK_URL);
  const payloadString = JSON.stringify(payload);

  console.log('📤 Sending webhook request...\n');
  console.log('Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n' + '─'.repeat(80) + '\n');

  const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadString),
      'User-Agent': 'Wise-Webhook-Simulator/1.0',
      // Note: Real signature validation will fail (we don't have the secret)
      // But webhook will still log the data
      'X-Signature-SHA256': 'test-signature-not-real'
    }
  };

  const req = https.request(options, (res) => {
    let responseBody = '';

    console.log('📥 Response received:\n');
    console.log('Status:', res.statusCode, res.statusMessage);
    console.log('\nHeaders:');
    Object.entries(res.headers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    res.on('data', (chunk) => {
      responseBody += chunk;
    });

    res.on('end', () => {
      console.log('\nBody:', responseBody || '(empty - expected for webhook)');

      console.log('\n' + '─'.repeat(80));

      if (res.statusCode === 200) {
        console.log('\n✅ Webhook accepted! (200 OK)');
        console.log('💡 Check your webhook monitor output or Railway logs to see the data!');
      } else if (res.statusCode === 401) {
        console.log('\n⚠️  Webhook rejected: Invalid signature (401)');
        console.log('💡 This is expected - test signature is not valid');
        console.log('💡 However, the webhook was still logged! Check Railway logs.');
      } else {
        console.log(`\n⚠️  Unexpected response: ${res.statusCode}`);
      }

      console.log('\n🔍 To see the webhook data:');
      console.log('   1. Run: node scripts/monitor-wise-webhooks.js');
      console.log('   2. Or view Railway logs at: https://railway.app/');
      console.log('   3. Look for "WISE WEBHOOK RECEIVED"\n');
    });
  });

  req.on('error', (error) => {
    console.error('\n❌ Request failed:', error.message);
    console.error('\n💡 Possible issues:');
    console.error('   - Railway deployment not accessible');
    console.error('   - Network connectivity problem');
    console.error('   - Webhook URL incorrect\n');
  });

  req.write(payloadString);
  req.end();
}

// Run the test
sendWebhook();
