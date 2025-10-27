const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Wise API Test Service',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test Wise API connection - Get Profiles
router.get('/test-profile', async (req, res) => {
  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || process.env.WISE_API_BASE_URL || 'https://api.wise.com';

  // Check if token is configured
  if (!WISE_API_TOKEN) {
    return res.status(500).json({
      success: false,
      error: 'WISE_API_TOKEN not configured',
      message: 'Please set WISE_API_TOKEN environment variable'
    });
  }

  try {
    console.log('Testing Wise API connection...');
    console.log('API URL:', WISE_API_URL);
    console.log('Token:', WISE_API_TOKEN.substring(0, 20) + '...');

    const response = await fetch(`${WISE_API_URL}/v1/profiles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Wise API Error:', response.status, data);
      return res.status(response.status).json({
        success: false,
        error: 'Wise API request failed',
        status: response.status,
        statusText: response.statusText,
        details: data,
        apiUrl: WISE_API_URL,
        tokenPrefix: WISE_API_TOKEN.substring(0, 20) + '...'
      });
    }

    console.log('Wise API Success:', data.length, 'profiles found');

    res.json({
      success: true,
      message: 'Wise API connection successful',
      profileCount: data.length,
      profiles: data.map(profile => ({
        id: profile.id,
        type: profile.type,
        name: profile.details ? `${profile.details.firstName || ''} ${profile.details.lastName || ''}`.trim() : null
      })),
      apiUrl: WISE_API_URL,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Wise API Test Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Wise API',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test Wise API - Get Balances
router.get('/test-balances/:profileId?', async (req, res) => {
  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || process.env.WISE_API_BASE_URL || 'https://api.wise.com';
  const profileId = req.params.profileId || process.env.WISE_PROFILE_ID;

  if (!WISE_API_TOKEN) {
    return res.status(500).json({
      success: false,
      error: 'WISE_API_TOKEN not configured'
    });
  }

  if (!profileId) {
    return res.status(400).json({
      success: false,
      error: 'Profile ID required',
      message: 'Provide profileId in URL or set WISE_PROFILE_ID environment variable',
      example: '/api/wise-test/test-balances/12345678'
    });
  }

  try {
    console.log('Fetching balances for profile:', profileId);

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

    const data = await response.json();

    if (!response.ok) {
      console.error('Wise API Error:', response.status, data);
      return res.status(response.status).json({
        success: false,
        error: 'Wise API request failed',
        status: response.status,
        details: data
      });
    }

    console.log('Balances retrieved:', data.length, 'currencies');

    res.json({
      success: true,
      message: 'Balances retrieved successfully',
      profileId,
      balanceCount: data.length,
      balances: data.map(balance => ({
        id: balance.id,
        currency: balance.currency,
        type: balance.type,
        available: balance.amount.value,
        reserved: balance.reservedAmount.value,
        total: balance.totalWorth.value
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Wise Balances Test Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balances',
      message: error.message
    });
  }
});

// Get environment configuration (safe, no secrets)
router.get('/config', (req, res) => {
  res.json({
    hasToken: !!process.env.WISE_API_TOKEN,
    tokenPrefix: process.env.WISE_API_TOKEN ? process.env.WISE_API_TOKEN.substring(0, 10) + '...' : null,
    apiUrl: process.env.WISE_API_URL || process.env.WISE_API_BASE_URL || 'https://api.wise.com',
    profileId: process.env.WISE_PROFILE_ID || null,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Comprehensive test - all Wise API endpoints
router.get('/test-all', async (req, res) => {
  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || process.env.WISE_API_BASE_URL || 'https://api.wise.com';
  const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

  const results = {
    success: false,
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  // Test 1: Configuration Check
  console.log('=== Test 1: Configuration Check ===');
  results.tests.configuration = {
    name: 'Configuration Check',
    status: 'pass',
    apiUrl: WISE_API_URL,
    hasToken: !!WISE_API_TOKEN,
    tokenPrefix: WISE_API_TOKEN ? WISE_API_TOKEN.substring(0, 10) + '...' : null,
    profileId: WISE_PROFILE_ID || 'Not set',
    environment: process.env.NODE_ENV || 'development'
  };
  results.summary.total++;
  results.summary.passed++;

  if (!WISE_API_TOKEN) {
    results.tests.configuration.status = 'fail';
    results.tests.configuration.error = 'WISE_API_TOKEN not configured';
    results.summary.passed--;
    results.summary.failed++;
    return res.status(500).json(results);
  }

  // Test 2: Profile Endpoint
  console.log('=== Test 2: Profile Endpoint ===');
  results.summary.total++;
  try {
    const profileResponse = await fetch(`${WISE_API_URL}/v1/profiles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const profileData = await profileResponse.json();

    if (!profileResponse.ok) {
      results.tests.profile = {
        name: 'Profile Endpoint',
        status: 'fail',
        endpoint: '/v1/profiles',
        httpStatus: profileResponse.status,
        error: profileData,
        message: 'Failed to fetch profiles'
      };
      results.summary.failed++;
      console.error('Profile test failed:', profileResponse.status, profileData);
    } else {
      results.tests.profile = {
        name: 'Profile Endpoint',
        status: 'pass',
        endpoint: '/v1/profiles',
        httpStatus: profileResponse.status,
        profileCount: profileData.length,
        profiles: profileData.map(p => ({
          id: p.id,
          type: p.type,
          name: p.details ? `${p.details.firstName || ''} ${p.details.lastName || ''}`.trim() : null
        }))
      };
      results.summary.passed++;
      console.log('Profile test passed:', profileData.length, 'profiles found');

      // Test 3: Balances Endpoint (only if profile test passed)
      console.log('=== Test 3: Balances Endpoint ===');
      results.summary.total++;

      const profileId = profileData[0]?.id || WISE_PROFILE_ID;

      if (!profileId) {
        results.tests.balances = {
          name: 'Balances Endpoint',
          status: 'fail',
          error: 'No profile ID available',
          message: 'Cannot test balances without a profile ID'
        };
        results.summary.failed++;
      } else {
        try {
          const balancesResponse = await fetch(
            `${WISE_API_URL}/v4/profiles/${profileId}/balances?types=STANDARD`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${WISE_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const balancesData = await balancesResponse.json();

          if (!balancesResponse.ok) {
            results.tests.balances = {
              name: 'Balances Endpoint',
              status: 'fail',
              endpoint: `/v4/profiles/${profileId}/balances`,
              httpStatus: balancesResponse.status,
              error: balancesData,
              message: 'Failed to fetch balances'
            };
            results.summary.failed++;
            console.error('Balances test failed:', balancesResponse.status, balancesData);
          } else {
            results.tests.balances = {
              name: 'Balances Endpoint',
              status: 'pass',
              endpoint: `/v4/profiles/${profileId}/balances`,
              httpStatus: balancesResponse.status,
              profileId: profileId,
              balanceCount: balancesData.length,
              currencies: balancesData.map(b => b.currency),
              balances: balancesData.map(b => ({
                currency: b.currency,
                available: b.amount.value,
                reserved: b.reservedAmount.value,
                total: b.totalWorth.value
              }))
            };
            results.summary.passed++;
            console.log('Balances test passed:', balancesData.length, 'currencies found');
          }
        } catch (error) {
          results.tests.balances = {
            name: 'Balances Endpoint',
            status: 'fail',
            error: error.message,
            message: 'Exception while testing balances endpoint'
          };
          results.summary.failed++;
          console.error('Balances test exception:', error);
        }
      }
    }
  } catch (error) {
    results.tests.profile = {
      name: 'Profile Endpoint',
      status: 'fail',
      error: error.message,
      message: 'Exception while testing profile endpoint'
    };
    results.summary.failed++;
    console.error('Profile test exception:', error);
  }

  // Set overall success
  results.success = results.summary.failed === 0;

  // Return appropriate status code
  const statusCode = results.success ? 200 : 500;
  res.status(statusCode).json(results);
});

module.exports = router;
