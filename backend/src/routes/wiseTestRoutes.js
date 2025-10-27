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

    const response = await fetch(`${WISE_API_URL}/v2/profiles`, {
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

module.exports = router;
