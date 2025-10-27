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
    title: '🧪 Wise API Integration Test Suite',
    success: false,
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  // Helper function to create progress bar
  const createProgressBar = (passed, total) => {
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
    const filledBlocks = Math.round((passed / total) * 20);
    const emptyBlocks = 20 - filledBlocks;
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    return `${bar} ${passed}/${total} (${percentage}%)`;
  };

  // Test 1: Configuration Check
  console.log('=== Test 1: Configuration Check ===');
  results.summary.total++;

  if (!WISE_API_TOKEN) {
    results.tests.configuration = {
      emoji: '❌',
      status: 'FAIL',
      name: '1️⃣ Configuration Check',
      description: 'Environment variables and settings',
      error: 'WISE_API_TOKEN not configured',
      hint: '💡 Set WISE_API_TOKEN in your environment variables',
      details: {
        apiUrl: WISE_API_URL,
        hasToken: false,
        profileId: WISE_PROFILE_ID || 'Not set',
        environment: process.env.NODE_ENV || 'development'
      }
    };
    results.summary.failed++;
    results.summary.emoji = '❌';
    results.summary.message = 'Configuration check failed';
    results.summary.progress = createProgressBar(results.summary.passed, results.summary.total);
    return res.status(500).json(results);
  }

  results.tests.configuration = {
    emoji: '✅',
    status: 'PASS',
    name: '1️⃣ Configuration Check',
    description: 'Environment variables and settings',
    message: 'All required variables are configured',
    details: {
      apiUrl: WISE_API_URL,
      hasToken: true,
      tokenPrefix: WISE_API_TOKEN.substring(0, 10) + '...',
      profileId: WISE_PROFILE_ID || 'Not set (will use profile from API)',
      environment: process.env.NODE_ENV || 'development'
    }
  };
  results.summary.passed++;

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
        emoji: '❌',
        status: 'FAIL',
        name: '2️⃣ Profile Endpoint',
        description: 'GET /v1/profiles - User profile information',
        error: profileData,
        hint: profileResponse.status === 401
          ? '💡 Check your WISE_API_TOKEN - it may be invalid or expired'
          : profileResponse.status === 404
          ? '💡 Check WISE_API_URL is set to https://api.wise.com'
          : '💡 Check Wise API status and your token permissions',
        details: {
          endpoint: `${WISE_API_URL}/v1/profiles`,
          httpStatus: profileResponse.status,
          httpStatusText: profileResponse.statusText
        }
      };
      results.summary.failed++;
      console.error('Profile test failed:', profileResponse.status, profileData);
    } else {
      results.tests.profile = {
        emoji: '✅',
        status: 'PASS',
        name: '2️⃣ Profile Endpoint',
        description: 'GET /v1/profiles - User profile information',
        message: `Found ${profileData.length} profile(s)`,
        details: {
          endpoint: `${WISE_API_URL}/v1/profiles`,
          httpStatus: profileResponse.status,
          profileCount: profileData.length,
          profiles: profileData.map(p => ({
            id: p.id,
            type: p.type === 'personal' ? '👤 Personal' : '🏢 Business',
            name: p.details ? `${p.details.firstName || ''} ${p.details.lastName || ''}`.trim() : '(No name)'
          }))
        }
      };
      results.summary.passed++;
      console.log('Profile test passed:', profileData.length, 'profiles found');

      // Test 3: Balances Endpoint (only if profile test passed)
      console.log('=== Test 3: Balances Endpoint ===');
      results.summary.total++;

      const profileId = profileData[0]?.id || WISE_PROFILE_ID;

      if (!profileId) {
        results.tests.balances = {
          emoji: '❌',
          status: 'FAIL',
          name: '3️⃣ Balances Endpoint',
          description: 'GET /v4/profiles/{id}/balances - Currency balances',
          error: 'No profile ID available',
          hint: '💡 Set WISE_PROFILE_ID in environment variables or ensure profile endpoint returns data',
          details: {}
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
              emoji: '❌',
              status: 'FAIL',
              name: '3️⃣ Balances Endpoint',
              description: 'GET /v4/profiles/{id}/balances - Currency balances',
              error: balancesData,
              hint: '💡 Check your API token has permissions to read balances',
              details: {
                endpoint: `${WISE_API_URL}/v4/profiles/${profileId}/balances`,
                httpStatus: balancesResponse.status,
                httpStatusText: balancesResponse.statusText,
                profileId: profileId
              }
            };
            results.summary.failed++;
            console.error('Balances test failed:', balancesResponse.status, balancesData);
          } else {
            // Currency emoji mapping
            const currencyEmojis = {
              'USD': '💵', 'EUR': '💶', 'GBP': '💷', 'JPY': '💴',
              'PLN': '🇵🇱', 'CHF': '🇨🇭', 'CAD': '🇨🇦', 'AUD': '🇦🇺'
            };

            results.tests.balances = {
              emoji: '✅',
              status: 'PASS',
              name: '3️⃣ Balances Endpoint',
              description: 'GET /v4/profiles/{id}/balances - Currency balances',
              message: `Found ${balancesData.length} currency balance(s)`,
              details: {
                endpoint: `${WISE_API_URL}/v4/profiles/${profileId}/balances`,
                httpStatus: balancesResponse.status,
                profileId: profileId,
                balanceCount: balancesData.length,
                currencies: balancesData.map(b => `${currencyEmojis[b.currency] || '💰'} ${b.currency}`),
                balances: balancesData.map(b => ({
                  currency: `${currencyEmojis[b.currency] || '💰'} ${b.currency}`,
                  available: `${b.amount.value.toFixed(2)} ${b.currency}`,
                  reserved: `${b.reservedAmount.value.toFixed(2)} ${b.currency}`,
                  total: `${b.totalWorth.value.toFixed(2)} ${b.currency}`
                }))
              }
            };
            results.summary.passed++;
            console.log('Balances test passed:', balancesData.length, 'currencies found');
          }
        } catch (error) {
          results.tests.balances = {
            emoji: '❌',
            status: 'FAIL',
            name: '3️⃣ Balances Endpoint',
            description: 'GET /v4/profiles/{id}/balances - Currency balances',
            error: error.message,
            hint: '💡 Check network connectivity and API URL configuration',
            details: {
              exception: error.message
            }
          };
          results.summary.failed++;
          console.error('Balances test exception:', error);
        }
      }
    }
  } catch (error) {
    results.tests.profile = {
      emoji: '❌',
      status: 'FAIL',
      name: '2️⃣ Profile Endpoint',
      description: 'GET /v1/profiles - User profile information',
      error: error.message,
      hint: error.message.includes('Unexpected token')
        ? '💡 WISE_API_URL is likely pointing to the wrong URL (should be https://api.wise.com)'
        : '💡 Check network connectivity and API configuration',
      details: {
        exception: error.message,
        attemptedUrl: `${WISE_API_URL}/v1/profiles`
      }
    };
    results.summary.failed++;
    console.error('Profile test exception:', error);
  }

  // Set overall success and create summary
  results.success = results.summary.failed === 0;

  results.summary.emoji = results.success ? '✅' : '❌';
  results.summary.message = results.success
    ? '🎉 All tests passed! Wise API integration is working correctly.'
    : `⚠️ ${results.summary.failed} test(s) failed. Check the details above for troubleshooting hints.`;
  results.summary.progress = createProgressBar(results.summary.passed, results.summary.total);

  // Return appropriate status code
  const statusCode = results.success ? 200 : 500;
  res.status(statusCode).json(results);
});

module.exports = router;
