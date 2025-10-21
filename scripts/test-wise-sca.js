#!/usr/bin/env node

/**
 * Wise SCA Authentication Test Script
 *
 * Purpose: Isolated testing of Wise SCA (Strong Customer Authentication)
 * to understand the exact authentication flow required.
 *
 * This script tests:
 * 1. Current RSA signature approach (OLD method - likely deprecated)
 * 2. New OTT (One-Time Token) status endpoint to see required challenges
 * 3. What authentication factors are required for our account
 *
 * Run: node scripts/test-wise-sca.js
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Wise API
  WISE_API_BASE: 'https://api.transferwise.com',
  WISE_API_TOKEN: '29500c1a-ddc4-416c-8ac3-875dc84ccb8f', // Full Access token
  WISE_PROFILE_ID: '74801255',

  // Test Balance IDs (from previous debugging)
  BALANCES: [
    { id: '134500252', currency: 'EUR', name: 'EUR Balance' },
    { id: '134500343', currency: 'USD', name: 'USD Balance' },
    { id: '134500428', currency: 'PLN', name: 'PLN Balance' }
  ],

  // Private key path
  PRIVATE_KEY_PATH: path.join(__dirname, '..', 'wise_sca_key'),
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Make HTTP request with full logging (using native https module)
 */
function makeRequest(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    console.log('\n' + '='.repeat(80));
    console.log(`🌐 ${method} ${url}`);
    console.log('='.repeat(80));

    if (options.headers) {
      console.log('\n📤 Request Headers:');
      Object.entries(options.headers).forEach(([key, value]) => {
        // Mask sensitive values
        const maskedValue = key.toLowerCase().includes('authorization') || key.toLowerCase().includes('signature')
          ? value.substring(0, 20) + '...'
          : value;
        console.log(`  ${key}: ${maskedValue}`);
      });
    }

    if (options.body) {
      console.log('\n📤 Request Body:');
      console.log(JSON.stringify(JSON.parse(options.body), null, 2));
    }

    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: options.headers || {}
    };

    const req = https.request(requestOptions, (res) => {
      let body = '';

      console.log(`\n📥 Response Status: ${res.statusCode} ${res.statusMessage}`);

      // Log all response headers
      console.log('\n📥 Response Headers:');
      Object.entries(res.headers).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        const contentType = res.headers['content-type'];
        let data;

        try {
          if (contentType && contentType.includes('application/json')) {
            data = JSON.parse(body);
            console.log('\n📥 Response Body:');
            console.log(JSON.stringify(data, null, 2));
          } else {
            console.log('\n📥 Response Body (text):');
            console.log(body.substring(0, 500));
            data = body;
          }
        } catch (error) {
          console.log('\n📥 Response Body (raw):');
          console.log(body.substring(0, 500));
          data = body;
        }

        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data,
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request failed:', error.message);
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Load and prepare private key for signing
 */
function loadPrivateKey() {
  try {
    const keyPath = CONFIG.PRIVATE_KEY_PATH;

    if (!fs.existsSync(keyPath)) {
      console.error(`❌ Private key not found at: ${keyPath}`);
      return null;
    }

    const privateKey = fs.readFileSync(keyPath, 'utf8');
    console.log('✅ Private key loaded successfully');
    console.log(`   Format: ${privateKey.substring(0, 30)}...`);
    console.log(`   Length: ${privateKey.length} characters`);

    return privateKey;
  } catch (error) {
    console.error('❌ Failed to load private key:', error.message);
    return null;
  }
}

/**
 * Sign a one-time token using RSA-SHA256
 */
function signToken(oneTimeToken, privateKey) {
  try {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(oneTimeToken, 'utf-8')); // UTF-8 encoding
    sign.end();

    const signature = sign.sign(privateKey, 'base64');

    console.log('\n🔐 Token Signature Generated:');
    console.log(`   Token: ${oneTimeToken.substring(0, 40)}...`);
    console.log(`   Signature length: ${signature.length} chars`);
    console.log(`   Signature (first 50): ${signature.substring(0, 50)}...`);

    return signature;
  } catch (error) {
    console.error('❌ Failed to sign token:', error.message);
    throw error;
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * TEST 1: Try to get balance statement (will return 403 with OTT)
 */
async function testGetBalanceStatement(balance) {
  console.log('\n' + '█'.repeat(80));
  console.log(`TEST 1: Get Balance Statement - ${balance.name}`);
  console.log('█'.repeat(80));

  const url = `${CONFIG.WISE_API_BASE}/v1/profiles/${CONFIG.WISE_PROFILE_ID}/balance-statements/${balance.id}/statement.json`;

  const params = new URLSearchParams({
    currency: balance.currency,
    intervalStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    intervalEnd: new Date().toISOString(),
    type: 'COMPACT'
  });

  const result = await makeRequest('GET', `${url}?${params}`, {
    headers: {
      'Authorization': `Bearer ${CONFIG.WISE_API_TOKEN}`,
      'Content-Type': 'application/json',
    }
  });

  // Check for SCA headers
  const scaResult = result.headers['x-2fa-approval-result'];
  const scaToken = result.headers['x-2fa-approval'];

  console.log('\n🔍 SCA Analysis:');
  console.log(`   x-2fa-approval-result: ${scaResult || 'NOT PRESENT'}`);
  console.log(`   x-2fa-approval (OTT): ${scaToken ? scaToken.substring(0, 40) + '...' : 'NOT PRESENT'}`);

  return { result, scaToken, scaResult };
}

/**
 * TEST 2: Check OTT status to see required challenges
 */
async function testGetOTTStatus(ott) {
  console.log('\n' + '█'.repeat(80));
  console.log('TEST 2: Get One-Time Token Status');
  console.log('█'.repeat(80));

  if (!ott) {
    console.log('⚠️  No OTT provided, skipping test');
    return null;
  }

  const url = `${CONFIG.WISE_API_BASE}/v1/one-time-token/status`;

  const result = await makeRequest('GET', url, {
    headers: {
      'Authorization': `Bearer ${CONFIG.WISE_API_TOKEN}`,
      'One-Time-Token': ott,
      'Content-Type': 'application/json',
    }
  });

  console.log('\n🔍 OTT Status Analysis:');
  if (result.data) {
    console.log(`   Action Type: ${result.data.actionType}`);
    console.log(`   Validity: ${result.data.validity} seconds`);
    console.log(`   Number of Challenges: ${result.data.challenges ? result.data.challenges.length : 0}`);

    if (result.data.challenges && result.data.challenges.length > 0) {
      console.log('\n   Challenges Required:');
      result.data.challenges.forEach((challenge, index) => {
        console.log(`\n   Challenge #${index + 1}:`);
        console.log(`      Primary: ${challenge.primaryChallenge?.type}`);
        console.log(`      Required: ${challenge.required}`);
        console.log(`      Passed: ${challenge.passed}`);

        if (challenge.alternatives && challenge.alternatives.length > 0) {
          console.log(`      Alternatives: ${challenge.alternatives.map(a => a.type).join(', ')}`);
        }
      });
    }
  }

  return result;
}

/**
 * TEST 3: Try RSA signature approach (OLD method)
 */
async function testRSASignatureApproach(balance, ott, privateKey) {
  console.log('\n' + '█'.repeat(80));
  console.log(`TEST 3: RSA Signature Approach (OLD METHOD) - ${balance.name}`);
  console.log('█'.repeat(80));

  if (!ott || !privateKey) {
    console.log('⚠️  No OTT or private key, skipping test');
    return null;
  }

  // Sign the OTT
  const signature = signToken(ott, privateKey);

  // Retry the balance statement request with signature
  const url = `${CONFIG.WISE_API_BASE}/v1/profiles/${CONFIG.WISE_PROFILE_ID}/balance-statements/${balance.id}/statement.json`;

  const params = new URLSearchParams({
    currency: balance.currency,
    intervalStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    intervalEnd: new Date().toISOString(),
    type: 'COMPACT'
  });

  const result = await makeRequest('GET', `${url}?${params}`, {
    headers: {
      'Authorization': `Bearer ${CONFIG.WISE_API_TOKEN}`,
      'x-2fa-approval': ott,
      'X-Signature': signature,
      'Content-Type': 'application/json',
    }
  });

  // Check result
  const scaResult = result.headers['x-2fa-approval-result'];

  console.log('\n🔍 RSA Signature Result:');
  console.log(`   x-2fa-approval-result: ${scaResult || 'NOT PRESENT'}`);

  if (scaResult === 'APPROVED') {
    console.log('   ✅ RSA SIGNATURE APPROVED!');
  } else if (scaResult === 'REJECTED') {
    console.log('   ❌ RSA SIGNATURE REJECTED (Expected - old method deprecated)');
  } else if (result.ok) {
    console.log('   ✅ REQUEST SUCCESSFUL!');
  } else {
    console.log(`   ❌ REQUEST FAILED: ${result.status}`);
  }

  return result;
}

/**
 * TEST 4: Check what SCA methods are available for our profile
 */
async function testCheckProfileSCAMethods() {
  console.log('\n' + '█'.repeat(80));
  console.log('TEST 4: Check Profile Details & Available SCA Methods');
  console.log('█'.repeat(80));

  // Get profile details
  const profileUrl = `${CONFIG.WISE_API_BASE}/v2/profiles/${CONFIG.WISE_PROFILE_ID}`;

  const result = await makeRequest('GET', profileUrl, {
    headers: {
      'Authorization': `Bearer ${CONFIG.WISE_API_TOKEN}`,
      'Content-Type': 'application/json',
    }
  });

  console.log('\n🔍 Profile Analysis:');
  if (result.data) {
    console.log(`   Profile Type: ${result.data.type}`);
    console.log(`   Profile ID: ${result.data.id}`);
    console.log(`   Details: ${result.data.details?.name || 'N/A'}`);
  }

  return result;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'WISE SCA AUTHENTICATION TEST SUITE' + ' '.repeat(24) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  try {
    // Load private key
    console.log('\n📋 Setup:');
    const privateKey = loadPrivateKey();

    // Run tests for first balance (EUR)
    const testBalance = CONFIG.BALANCES[0]; // EUR

    // TEST 1: Get balance statement (will trigger 403 with OTT)
    const { scaToken, scaResult } = await testGetBalanceStatement(testBalance);

    // TEST 2: Check OTT status
    if (scaToken) {
      await testGetOTTStatus(scaToken);
    }

    // TEST 3: Try RSA signature approach
    if (scaToken && privateKey) {
      await testRSASignatureApproach(testBalance, scaToken, privateKey);
    }

    // TEST 4: Check profile SCA methods
    await testCheckProfileSCAMethods();

    // SUMMARY
    console.log('\n' + '╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(32) + 'TEST SUMMARY' + ' '.repeat(34) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');

    console.log('\n📊 Results:');
    console.log(`   ✅ Successfully triggered SCA flow: ${scaToken ? 'YES' : 'NO'}`);
    console.log(`   ✅ Received One-Time Token (OTT): ${scaToken ? 'YES' : 'NO'}`);
    console.log(`   ✅ RSA Signature tested: ${privateKey && scaToken ? 'YES' : 'NO'}`);
    console.log(`   📝 Current SCA Result: ${scaResult || 'N/A'}`);

    console.log('\n💡 Next Steps:');
    console.log('   1. Review the OTT status response to see required challenges');
    console.log('   2. Check if RSA signature is APPROVED or REJECTED');
    console.log('   3. If REJECTED, we need to implement new SCA flow with challenge verification');
    console.log('   4. May need to enroll authentication factors (PIN, Device Fingerprint, etc.)');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests().then(() => {
  console.log('\n✅ Test suite completed\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
