#!/usr/bin/env node

/**
 * Test Wise API - Get Profile
 *
 * Tests the Wise API connection by fetching user profiles.
 * This is the simplest endpoint to verify API token works.
 *
 * Usage:
 *   node scripts/test-wise-profile.js
 *
 * Environment Variables:
 *   WISE_API_TOKEN - Your Wise API token
 *   WISE_API_URL - (Optional) Defaults to production, use sandbox for testing
 */

require('dotenv').config();

const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_API_URL = process.env.WISE_API_URL || process.env.WISE_API_BASE_URL || 'https://api.wise.com';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

async function testWiseProfile() {
  logSection('Wise API Profile Test');

  // Check for API token
  if (!WISE_API_TOKEN) {
    logError('WISE_API_TOKEN environment variable is not set!');
    console.log('\nPlease set your Wise API token:');
    console.log('  export WISE_API_TOKEN="your-api-token-here"');
    console.log('\nOr add to your .env file:');
    console.log('  WISE_API_TOKEN=your-api-token-here');
    process.exit(1);
  }

  // Display configuration
  logInfo(`API URL: ${WISE_API_URL}`);
  logInfo(`Token: ${WISE_API_TOKEN.substring(0, 20)}...`);
  console.log();

  try {
    // Make API request
    logInfo('Fetching user profiles...');

    const response = await fetch(`${WISE_API_URL}/v2/profiles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

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

      // Provide helpful error messages
      console.log();
      if (response.status === 401) {
        logError('Authentication failed. Please check your API token.');
      } else if (response.status === 403) {
        logError('Forbidden. Your API token may not have the required permissions.');
      } else if (response.status === 404) {
        logError('Endpoint not found. Check the API URL.');
      }

      process.exit(1);
    }

    // Display profiles
    logSection('User Profiles');

    if (!Array.isArray(data) || data.length === 0) {
      logWarning('No profiles found for this account.');
      console.log('\nResponse:', JSON.stringify(data, null, 2));
      return;
    }

    logSuccess(`Found ${data.length} profile(s)`);
    console.log();

    data.forEach((profile, index) => {
      console.log(`${colors.bright}Profile ${index + 1}:${colors.reset}`);
      console.log(`  ID: ${colors.cyan}${profile.id}${colors.reset}`);
      console.log(`  Type: ${colors.yellow}${profile.type}${colors.reset}`);

      if (profile.details) {
        const { firstName, lastName, dateOfBirth, phoneNumber } = profile.details;

        if (firstName || lastName) {
          console.log(`  Name: ${firstName || ''} ${lastName || ''}`);
        }
        if (dateOfBirth) {
          console.log(`  DOB: ${dateOfBirth}`);
        }
        if (phoneNumber) {
          console.log(`  Phone: ${phoneNumber}`);
        }
      }

      console.log();
    });

    // Save profile IDs for other scripts
    if (data.length > 0) {
      const profileId = data[0].id;
      logSection('Next Steps');
      logInfo('Use this profile ID for other Wise API calls:');
      console.log(`  ${colors.green}${profileId}${colors.reset}`);
      console.log();
      console.log('Example commands:');
      console.log(`  export WISE_PROFILE_ID=${profileId}`);
      console.log();
      console.log('Or test balances:');
      console.log(`  node scripts/test-wise-balances.js ${profileId}`);
    }

    logSection('Test Complete');
    logSuccess('Wise API connection verified successfully!');

  } catch (error) {
    logSection('Error');
    logError(`Test failed: ${error.message}`);

    if (error.cause) {
      console.log('\nCause:', error.cause);
    }

    console.log('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testWiseProfile().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
