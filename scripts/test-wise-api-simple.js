#!/usr/bin/env node

/**
 * Wise API Simple Diagnostic Script
 *
 * This script tests Wise API access from scratch based on Wise support's feedback.
 *
 * According to Wise support (Sergio):
 * - You DON'T need Partner API
 * - Personal tokens SHOULD work
 * - Error 403 might be due to wrong profile ID, balance ID, or inactive currency
 *
 * This script will:
 * 1. Test if your API token works
 * 2. Get your actual profile IDs
 * 3. Get balance IDs for each currency
 * 4. Try to fetch balance statements
 * 5. Show detailed error information
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const CONFIG = {
  apiToken: process.env.WISE_API_TOKEN,
  apiBaseUrl: process.env.WISE_API_BASE_URL || 'https://api.transferwise.com',
  profileId: process.env.WISE_PROFILE_ID, // We'll validate this
};

// Color output for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Create axios instance
function createWiseClient() {
  return axios.create({
    baseURL: CONFIG.apiBaseUrl,
    headers: {
      'Authorization': `Bearer ${CONFIG.apiToken}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Test 1: Verify API token works
 */
async function testAuthentication(client) {
  logSection('TEST 1: API Token Authentication');

  try {
    logInfo('Testing if API token is valid...');

    const response = await client.get('/v1/me');

    logSuccess('API token is valid!');
    logInfo(`User ID: ${response.data.id}`);
    logInfo(`Email: ${response.data.email}`);

    return {
      success: true,
      userId: response.data.id,
      email: response.data.email,
    };
  } catch (error) {
    logError('API token authentication failed');
    logError(`Status: ${error.response?.status}`);
    logError(`Message: ${error.response?.data?.message || error.message}`);

    if (error.response?.status === 401) {
      logWarning('Your API token appears to be invalid or expired');
      logWarning('Generate a new token at: https://wise.com/settings/api-tokens');
    }

    return { success: false, error };
  }
}

/**
 * Test 2: Get all profiles
 */
async function testGetProfiles(client) {
  logSection('TEST 2: Fetch Your Profiles');

  try {
    logInfo('Fetching all profiles associated with your account...');

    const response = await client.get('/v2/profiles');

    logSuccess(`Found ${response.data.length} profile(s)`);

    response.data.forEach((profile, index) => {
      log(`\n  Profile ${index + 1}:`, 'bright');
      logInfo(`    ID: ${profile.id}`);
      logInfo(`    Type: ${profile.type}`);
      logInfo(`    Full Name: ${profile.details?.name || profile.details?.companyName || 'N/A'}`);

      if (CONFIG.profileId && profile.id.toString() === CONFIG.profileId.toString()) {
        logSuccess('    ✓ This matches your WISE_PROFILE_ID in .env');
      }
    });

    return {
      success: true,
      profiles: response.data,
    };
  } catch (error) {
    logError('Failed to fetch profiles');
    logError(`Status: ${error.response?.status}`);
    logError(`Message: ${error.response?.data?.message || error.message}`);

    return { success: false, error };
  }
}

/**
 * Test 3: Get balances for a specific profile
 */
async function testGetBalances(client, profileId) {
  logSection(`TEST 3: Fetch Balances for Profile ${profileId}`);

  try {
    logInfo('Fetching all currency balances...');

    const response = await client.get(`/v4/profiles/${profileId}/balances`, {
      params: { types: 'STANDARD' },
    });

    logSuccess(`Found ${response.data.length} currency balance(s)`);

    const balances = [];

    response.data.forEach((balance, index) => {
      log(`\n  Balance ${index + 1}:`, 'bright');
      logInfo(`    Balance ID: ${balance.id}`);
      logInfo(`    Currency: ${balance.currency}`);
      logInfo(`    Amount: ${balance.amount.value} ${balance.currency}`);
      logInfo(`    Status: ${balance.active ? 'ACTIVE ✓' : 'INACTIVE ❌'}`);

      if (!balance.active) {
        logWarning(`    ⚠️  This currency account is INACTIVE - API calls will fail!`);
      }

      balances.push({
        id: balance.id,
        currency: balance.currency,
        amount: balance.amount.value,
        active: balance.active,
      });
    });

    return {
      success: true,
      balances,
    };
  } catch (error) {
    logError('Failed to fetch balances');
    logError(`Status: ${error.response?.status}`);
    logError(`Message: ${error.response?.data?.message || error.message}`);

    if (error.response?.status === 403) {
      logWarning('403 Forbidden - Possible causes:');
      logWarning('  1. Profile ID does not belong to your account');
      logWarning('  2. API token lacks permissions');
      logWarning('  3. Profile is not verified/active');
    }

    return { success: false, error };
  }
}

/**
 * Test 4: Try to get balance statement (the endpoint that was failing)
 */
async function testGetBalanceStatement(client, profileId, balanceId, currency) {
  logSection(`TEST 4: Fetch Balance Statement for ${currency}`);

  try {
    logInfo(`Balance ID: ${balanceId}`);
    logInfo(`Currency: ${currency}`);
    logInfo('Attempting to fetch balance statement...');

    // Date range: last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const params = {
      currency: currency,
      intervalStart: startDate.toISOString(),
      intervalEnd: endDate.toISOString(),
      type: 'COMPACT', // or 'FLAT'
    };

    logInfo(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    const response = await client.get(
      `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json`,
      { params }
    );

    logSuccess('Balance statement fetched successfully!');
    logInfo(`Transactions found: ${response.data.transactions?.length || 0}`);

    if (response.data.transactions && response.data.transactions.length > 0) {
      log(`\n  Sample transaction:`, 'bright');
      const tx = response.data.transactions[0];
      logInfo(`    Date: ${tx.date}`);
      logInfo(`    Type: ${tx.type}`);
      logInfo(`    Amount: ${tx.amount.value} ${tx.amount.currency}`);
      logInfo(`    Description: ${tx.details.description || 'N/A'}`);
    }

    return {
      success: true,
      transactionCount: response.data.transactions?.length || 0,
    };
  } catch (error) {
    logError('Failed to fetch balance statement');
    logError(`Status: ${error.response?.status}`);

    // Check for special headers
    const headers = error.response?.headers || {};
    if (headers['x-2fa-approval-result']) {
      logError(`x-2fa-approval-result: ${headers['x-2fa-approval-result']}`);
    }
    if (headers['x-2fa-approval']) {
      logInfo(`x-2fa-approval (OTT): ${headers['x-2fa-approval']}`);
    }

    logError(`Message: ${error.response?.data?.message || error.message}`);

    // Interpret the error based on Wise support's feedback
    if (error.response?.status === 403) {
      log('\n  Possible causes (from Wise support):', 'yellow');
      logWarning('  1. Balance ID doesn\'t belong to this profile');
      logWarning('  2. Currency account is inactive/closed');
      logWarning('  3. Wrong currency parameter');
      logWarning('  4. This endpoint requires Strong Customer Authentication (SCA)');

      if (headers['x-2fa-approval-result'] === 'REJECTED') {
        log('\n  SCA Analysis:', 'yellow');
        logWarning('  The API is asking for Strong Customer Authentication');
        logWarning('  This means we need to sign the request with RSA keys');
        logWarning('  BUT - check if the balance ID and currency are correct first!');
      }
    }

    if (error.response?.data) {
      log('\n  Full error response:', 'red');
      console.log(JSON.stringify(error.response.data, null, 2));
    }

    return { success: false, error };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║   WISE API DIAGNOSTIC TEST - FROM SCRATCH                  ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  // Validate environment
  if (!CONFIG.apiToken) {
    logError('\nWISE_API_TOKEN not found in .env file!');
    logWarning('Please add: WISE_API_TOKEN=your_token_here');
    process.exit(1);
  }

  logInfo(`Using API: ${CONFIG.apiBaseUrl}`);
  logInfo(`Token: ${CONFIG.apiToken.substring(0, 10)}...`);

  const client = createWiseClient();

  // Test 1: Authentication
  const authResult = await testAuthentication(client);
  if (!authResult.success) {
    logError('\n❌ STOPPED: Fix API token before continuing');
    process.exit(1);
  }

  // Test 2: Get Profiles
  const profilesResult = await testGetProfiles(client);
  if (!profilesResult.success) {
    logError('\n❌ STOPPED: Cannot fetch profiles');
    process.exit(1);
  }

  if (profilesResult.profiles.length === 0) {
    logError('\n❌ No profiles found in your account');
    process.exit(1);
  }

  // Use the first profile or the one from .env
  let selectedProfile;
  if (CONFIG.profileId) {
    selectedProfile = profilesResult.profiles.find(
      p => p.id.toString() === CONFIG.profileId.toString()
    );
    if (!selectedProfile) {
      logWarning(`\n⚠️  WISE_PROFILE_ID (${CONFIG.profileId}) not found in your profiles!`);
      logWarning('Using the first profile instead...');
      selectedProfile = profilesResult.profiles[0];
    }
  } else {
    selectedProfile = profilesResult.profiles[0];
    logInfo(`\n💡 Using first profile: ${selectedProfile.id}`);
  }

  // Test 3: Get Balances
  const balancesResult = await testGetBalances(client, selectedProfile.id);
  if (!balancesResult.success) {
    logError('\n❌ STOPPED: Cannot fetch balances');
    process.exit(1);
  }

  if (balancesResult.balances.length === 0) {
    logWarning('\n⚠️  No balances found for this profile');
    logWarning('You may need to activate currency accounts first');
    process.exit(0);
  }

  // Test 4: Try balance statements for each active currency
  for (const balance of balancesResult.balances) {
    if (!balance.active) {
      logWarning(`\n⏭️  Skipping ${balance.currency} - account is inactive`);
      continue;
    }

    await testGetBalanceStatement(
      client,
      selectedProfile.id,
      balance.id,
      balance.currency
    );
  }

  // Summary
  logSection('SUMMARY');
  logSuccess(`API token: Working ✓`);
  logSuccess(`Profiles: ${profilesResult.profiles.length} found ✓`);
  logSuccess(`Balances: ${balancesResult.balances.length} found ✓`);

  const activeBalances = balancesResult.balances.filter(b => b.active);
  if (activeBalances.length > 0) {
    logInfo(`Active currencies: ${activeBalances.map(b => b.currency).join(', ')}`);
  }

  log('\n✨ Test complete!\n', 'green');
}

// Run the tests
runTests().catch(error => {
  logError('\n💥 Unexpected error:');
  console.error(error);
  process.exit(1);
});
