#!/usr/bin/env node

/**
 * Create Wise Webhook Subscription for Balance Updates
 *
 * Subscribes to balances#update events which include BOTH:
 * - Incoming transactions (credits)
 * - Outgoing transactions (debits)
 * - With full amount information
 *
 * Usage:
 *   node scripts/create-wise-webhook.js
 *
 * Requirements:
 *   - WISE_API_TOKEN environment variable
 *   - WISE_PROFILE_ID environment variable
 */

const https = require('https');

// Get environment variables from command line or environment
const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;
const WEBHOOK_URL = 'https://business-accounting-system-production.up.railway.app/api/wise/webhook';

console.log('╔' + '═'.repeat(78) + '╗');
console.log('║' + ' '.repeat(20) + 'Wise Webhook Subscription Creator' + ' '.repeat(25) + '║');
console.log('╚' + '═'.repeat(78) + '╝\n');

// Validate environment variables
if (!WISE_API_TOKEN) {
  console.error('❌ ERROR: WISE_API_TOKEN environment variable not set');
  console.error('   Please set it in backend/.env file\n');
  process.exit(1);
}

if (!WISE_PROFILE_ID) {
  console.error('❌ ERROR: WISE_PROFILE_ID environment variable not set');
  console.error('   Please set it in backend/.env file\n');
  process.exit(1);
}

console.log('✅ Configuration:');
console.log(`   Profile ID: ${WISE_PROFILE_ID}`);
console.log(`   Webhook URL: ${WEBHOOK_URL}`);
console.log(`   Event Type: balances#update (includes credits + debits)\n`);

// Payload for creating webhook subscription
const subscriptionPayload = {
  name: 'Balance Updates Webhook (Credits + Debits)',
  trigger_on: 'balances#update',
  delivery: {
    version: '3.0.0',
    url: WEBHOOK_URL
  }
};

console.log('📦 Subscription Payload:');
console.log(JSON.stringify(subscriptionPayload, null, 2));
console.log('\n' + '─'.repeat(80) + '\n');

// Make API request to create subscription
const payloadString = JSON.stringify(subscriptionPayload);

const options = {
  hostname: 'api.transferwise.com',
  port: 443,
  path: `/v3/profiles/${WISE_PROFILE_ID}/subscriptions`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${WISE_API_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString)
  }
};

console.log('📤 Sending request to Wise API...\n');

const req = https.request(options, (res) => {
  let responseBody = '';

  console.log(`📥 Response Status: ${res.statusCode} ${res.statusMessage}\n`);

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    console.log('Response Body:');

    try {
      const response = JSON.parse(responseBody);
      console.log(JSON.stringify(response, null, 2));
      console.log('\n' + '─'.repeat(80) + '\n');

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ SUCCESS! Webhook subscription created!\n');
        console.log('📋 Subscription Details:');
        console.log(`   ID: ${response.id}`);
        console.log(`   Name: ${response.name}`);
        console.log(`   Event: ${response.trigger_on}`);
        console.log(`   URL: ${response.delivery.url}`);
        console.log(`   Version: ${response.delivery.version}`);
        console.log(`   Created: ${response.created_at || 'N/A'}\n`);

        console.log('🎯 Next Steps:');
        console.log('   1. Make a transaction in Wise (send or receive money)');
        console.log('   2. Check webhook monitor: https://business-accounting-system-production.up.railway.app/api/webhook-monitor');
        console.log('   3. Verify you see the transaction with amount!\n');
      } else {
        console.log('❌ FAILED to create webhook subscription\n');
        console.log('💡 Common Issues:');
        console.log('   - Invalid WISE_API_TOKEN');
        console.log('   - Invalid WISE_PROFILE_ID');
        console.log('   - Subscription already exists');
        console.log('   - Profile doesn\'t have permission for webhook subscriptions\n');
      }
    } catch (error) {
      console.log(responseBody);
      console.log('\n❌ Failed to parse response as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.error('\n💡 Possible issues:');
  console.error('   - Network connectivity problem');
  console.error('   - Wise API unavailable\n');
});

req.write(payloadString);
req.end();
