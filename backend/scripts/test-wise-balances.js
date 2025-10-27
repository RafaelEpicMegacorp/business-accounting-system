#!/usr/bin/env node

/**
 * Test Wise API - Get Balances
 *
 * Tests fetching balance information for a specific profile.
 *
 * Usage:
 *   node scripts/test-wise-balances.js [profileId]
 *
 * Environment Variables:
 *   WISE_API_TOKEN - Your Wise API token
 *   WISE_PROFILE_ID - (Optional) Your Wise profile ID
 *   WISE_API_URL - (Optional) Defaults to production
 */

require('dotenv').config();

const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_API_URL = process.env.WISE_API_URL || 'https://api.transferwise.com';
const profileId = process.argv[2] || process.env.WISE_PROFILE_ID;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function formatCurrency(amount, currency) {
  return `${colors.green}${amount.toFixed(2)} ${currency}${colors.reset}`;
}

async function testWiseBalances() {
  logSection('Wise API Balances Test');

  // Check for API token
  if (!WISE_API_TOKEN) {
    logError('WISE_API_TOKEN environment variable is not set!');
    process.exit(1);
  }

  // Check for profile ID
  if (!profileId) {
    logError('Profile ID is required!');
    console.log('\nUsage:');
    console.log('  node scripts/test-wise-balances.js <profileId>');
    console.log('\nOr set environment variable:');
    console.log('  export WISE_PROFILE_ID=your-profile-id');
    console.log('\nRun this first to get your profile ID:');
    console.log('  node scripts/test-wise-profile.js');
    process.exit(1);
  }

  // Display configuration
  logInfo(`API URL: ${WISE_API_URL}`);
  logInfo(`Profile ID: ${profileId}`);
  logInfo(`Token: ${WISE_API_TOKEN.substring(0, 20)}...`);
  console.log();

  try {
    // Make API request
    logInfo('Fetching balances for profile...');

    const response = await fetch(
      `${WISE_API_URL}/v4/profiles/${profileId}/balances?types=STANDARD`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Log response status
    console.log();
    if (response.ok) {
      logSuccess(`HTTP ${response.status} ${response.statusText}`);
    } else {
      logError(`HTTP ${response.status} ${response.statusText}`);
    }

    // Parse response
    const data = await response.json();

    if (!response.ok) {
      logSection('Error Response');
      console.log(JSON.stringify(data, null, 2));

      if (response.status === 401) {
        logError('Authentication failed.');
      } else if (response.status === 403) {
        logError('Forbidden. Check API permissions.');
      } else if (response.status === 404) {
        logError('Profile not found. Check the profile ID.');
      }

      process.exit(1);
    }

    // Display balances
    logSection('Currency Balances');

    if (!Array.isArray(data) || data.length === 0) {
      logInfo('No balances found for this profile.');
      console.log('\nYou may need to open currency accounts first at wise.com');
      return;
    }

    logSuccess(`Found ${data.length} balance(s)`);
    console.log();

    let totalUSD = 0;

    data.forEach((balance, index) => {
      const { id, currency, type, amount, reservedAmount, cashAmount, totalWorth } = balance;

      console.log(`${colors.bright}${currency} Balance:${colors.reset}`);
      console.log(`  Balance ID: ${colors.cyan}${id}${colors.reset}`);
      console.log(`  Type: ${type}`);
      console.log(`  Available: ${formatCurrency(amount.value, amount.currency)}`);
      console.log(`  Reserved: ${formatCurrency(reservedAmount.value, reservedAmount.currency)}`);
      console.log(`  Cash: ${formatCurrency(cashAmount.value, cashAmount.currency)}`);
      console.log(`  Total Worth: ${formatCurrency(totalWorth.value, totalWorth.currency)}`);

      // Rough USD conversion (for display only)
      if (currency === 'USD') {
        totalUSD += amount.value;
      } else if (currency === 'EUR') {
        totalUSD += amount.value * 1.10; // Rough estimate
      } else if (currency === 'GBP') {
        totalUSD += amount.value * 1.27; // Rough estimate
      } else if (currency === 'PLN') {
        totalUSD += amount.value * 0.25; // Rough estimate
      }

      console.log();
    });

    // Summary
    logSection('Summary');
    logInfo(`Total Currencies: ${data.length}`);
    logInfo(`Estimated Total (USD): ~${formatCurrency(totalUSD, 'USD')}`);
    console.log();
    log('Note: USD conversion is approximate. Use Wise API rates for accuracy.', colors.yellow);

    // Next steps
    logSection('Next Steps');
    console.log('To test balance statements (transaction history):');
    console.log();

    const firstBalance = data[0];
    console.log(`  node scripts/test-wise-statement.js ${profileId} ${firstBalance.id} ${firstBalance.currency}`);

    logSection('Test Complete');
    logSuccess('Successfully retrieved balances!');

  } catch (error) {
    logSection('Error');
    logError(`Test failed: ${error.message}`);
    console.log('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testWiseBalances().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
