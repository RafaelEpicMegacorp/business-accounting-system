const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Environment variables
const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';
const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

/**
 * GET /api/wise/debug/current-config
 * Show current Wise configuration (without exposing token)
 */
router.get('/current-config', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        WISE_API_URL,
        WISE_PROFILE_ID,
        WISE_API_TOKEN: WISE_API_TOKEN ? `${WISE_API_TOKEN.substring(0, 8)}...` : 'NOT SET',
        tokenConfigured: !!WISE_API_TOKEN,
        profileConfigured: !!WISE_PROFILE_ID
      },
      warnings: [
        !WISE_API_TOKEN && 'WISE_API_TOKEN is not set',
        !WISE_PROFILE_ID && 'WISE_PROFILE_ID is not set',
        WISE_API_URL !== 'https://api.wise.com' && 'WISE_API_URL should be https://api.wise.com'
      ].filter(Boolean)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/wise/debug/list-profiles
 * List all Wise profiles accessible with current API token
 */
router.get('/list-profiles', auth, async (req, res) => {
  try {
    if (!WISE_API_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'WISE_API_TOKEN environment variable is not set'
      });
    }

    console.log('🔍 Fetching all Wise profiles...');

    const response = await fetch(`${WISE_API_URL}/v1/profiles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Wise API error: ${response.status} ${errorText}`);
    }

    const profiles = await response.json();
    console.log(`✓ Found ${profiles.length} profiles`);

    // Enhance profiles with summary information
    const enrichedProfiles = profiles.map(profile => ({
      id: profile.id,
      type: profile.type,
      name: profile.type === 'personal'
        ? `${profile.details?.firstName || ''} ${profile.details?.lastName || ''}`.trim()
        : profile.details?.name || 'Business Account',
      primaryCurrency: profile.details?.primaryCurrency || 'Unknown',
      fullAddress: profile.details?.fullAddress || null,
      isCurrent: profile.id === parseInt(WISE_PROFILE_ID)
    }));

    // Find business profiles
    const businessProfiles = enrichedProfiles.filter(p => p.type === 'business');
    const personalProfiles = enrichedProfiles.filter(p => p.type === 'personal');

    // Recommendation
    let recommendation = null;
    if (businessProfiles.length > 0) {
      recommendation = `Found ${businessProfiles.length} business profile(s). For business transactions, use the business profile.`;
    } else if (personalProfiles.length > 0) {
      recommendation = `Only personal profiles found. Verify if business account API token is being used.`;
    }

    res.json({
      success: true,
      totalProfiles: profiles.length,
      businessProfiles: businessProfiles.length,
      personalProfiles: personalProfiles.length,
      currentProfileId: parseInt(WISE_PROFILE_ID) || null,
      profiles: enrichedProfiles,
      recommendation,
      nextSteps: [
        businessProfiles.length > 0
          ? `Test business profile ${businessProfiles[0].id} with: GET /api/wise/debug/test-profile/${businessProfiles[0].id}`
          : 'Generate new API token from Wise business account'
      ]
    });

  } catch (error) {
    console.error('❌ Error listing profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: error.message.includes('401')
        ? 'API token is invalid or expired. Generate new token from Wise dashboard.'
        : error.message.includes('403')
        ? 'API token lacks required permissions. Regenerate with "Read" permissions.'
        : 'Check WISE_API_URL and WISE_API_TOKEN configuration.'
    });
  }
});

/**
 * GET /api/wise/debug/test-profile/:profileId
 * Test specific profile for activities and balances
 */
router.get('/test-profile/:profileId', auth, async (req, res) => {
  const { profileId } = req.params;

  try {
    if (!WISE_API_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'WISE_API_TOKEN environment variable is not set'
      });
    }

    console.log(`🔍 Testing profile ${profileId}...`);

    const results = {
      profileId: parseInt(profileId),
      profileInfo: null,
      activities: { status: 'NOT_TESTED', count: 0, error: null },
      balances: { status: 'NOT_TESTED', currencies: {}, error: null },
      statements: { status: 'NOT_TESTED', transactionCount: 0, error: null }
    };

    // Test 1: Get profile info
    try {
      console.log('  Test 1: Profile info...');
      const profileResponse = await fetch(`${WISE_API_URL}/v1/profiles/${profileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        results.profileInfo = {
          id: profile.id,
          type: profile.type,
          name: profile.type === 'personal'
            ? `${profile.details?.firstName || ''} ${profile.details?.lastName || ''}`.trim()
            : profile.details?.name || 'Business Account'
        };
        console.log(`    ✓ Profile: ${results.profileInfo.name} (${results.profileInfo.type})`);
      } else {
        results.profileInfo = { error: `HTTP ${profileResponse.status}` };
      }
    } catch (error) {
      results.profileInfo = { error: error.message };
    }

    // Test 2: Get activities (last 2 years)
    try {
      console.log('  Test 2: Activities...');
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const activitiesResponse = await fetch(
        `${WISE_API_URL}/v1/profiles/${profileId}/activities?` +
        `createdDateStart=${twoYearsAgo.toISOString()}&` +
        `limit=1000`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${WISE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (activitiesResponse.ok) {
        const data = await activitiesResponse.json();
        const activities = data.activities || [];
        results.activities.status = 'PASSED';
        results.activities.count = activities.length;

        // Sample first 3 activities
        results.activities.sample = activities.slice(0, 3).map(a => ({
          type: a.type,
          date: a.createdAt,
          resource: a.resource?.type
        }));

        console.log(`    ✓ Found ${activities.length} activities`);
      } else {
        results.activities.status = 'FAILED';
        results.activities.error = `HTTP ${activitiesResponse.status}`;
        console.log(`    ✗ Failed: ${activitiesResponse.status}`);
      }
    } catch (error) {
      results.activities.status = 'ERROR';
      results.activities.error = error.message;
      console.log(`    ✗ Error: ${error.message}`);
    }

    // Test 3: Get balances
    try {
      console.log('  Test 3: Balances...');
      const balancesResponse = await fetch(
        `${WISE_API_URL}/v4/profiles/${profileId}/balances?types=STANDARD`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${WISE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (balancesResponse.ok) {
        const balances = await balancesResponse.json();
        results.balances.status = 'PASSED';

        // Extract currency amounts
        balances.forEach(balance => {
          results.balances.currencies[balance.currency] = balance.amount.value;
        });

        console.log(`    ✓ Found ${balances.length} currency balances`);
        Object.entries(results.balances.currencies).forEach(([currency, amount]) => {
          console.log(`      ${currency}: ${amount}`);
        });
      } else {
        results.balances.status = 'FAILED';
        results.balances.error = `HTTP ${balancesResponse.status}`;
        console.log(`    ✗ Failed: ${balancesResponse.status}`);
      }
    } catch (error) {
      results.balances.status = 'ERROR';
      results.balances.error = error.message;
      console.log(`    ✗ Error: ${error.message}`);
    }

    // Test 4: Get sample statement (if balances exist)
    if (results.balances.status === 'PASSED' && Object.keys(results.balances.currencies).length > 0) {
      try {
        console.log('  Test 4: Balance statement...');

        // Get first balance with non-zero amount
        const firstBalance = Object.entries(results.balances.currencies)
          .find(([_, amount]) => amount > 0);

        if (firstBalance) {
          const [currency] = firstBalance;

          // Get balance ID from balances response
          const balancesResponse = await fetch(
            `${WISE_API_URL}/v4/profiles/${profileId}/balances?types=STANDARD`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${WISE_API_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (balancesResponse.ok) {
            const balances = await balancesResponse.json();
            const balance = balances.find(b => b.currency === currency);

            if (balance) {
              // Try to get statement for last 30 days
              const now = new Date();
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(now.getDate() - 30);

              const statementResponse = await fetch(
                `${WISE_API_URL}/v1/profiles/${profileId}/balance-statements/${balance.id}/statement.json?` +
                `currency=${currency}&` +
                `intervalStart=${thirtyDaysAgo.toISOString()}&` +
                `intervalEnd=${now.toISOString()}&` +
                `type=COMPACT`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${WISE_API_TOKEN}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (statementResponse.ok) {
                const statement = await statementResponse.json();
                results.statements.status = 'PASSED';
                results.statements.transactionCount = statement.transactions?.length || 0;
                console.log(`    ✓ Found ${results.statements.transactionCount} transactions in ${currency}`);
              } else {
                results.statements.status = 'FAILED';
                results.statements.error = `HTTP ${statementResponse.status}`;
              }
            }
          }
        }
      } catch (error) {
        results.statements.status = 'ERROR';
        results.statements.error = error.message;
        console.log(`    ✗ Error: ${error.message}`);
      }
    }

    // Generate recommendation
    let recommendation = '';
    if (results.activities.count > 0 && Object.keys(results.balances.currencies).length > 0) {
      recommendation = '✅ This profile has transactions and balances - USE THIS ONE!';
    } else if (results.activities.count === 0 && Object.values(results.balances.currencies).every(v => v === 0)) {
      recommendation = '❌ Empty profile - no activity or balances. Try another profile.';
    } else if (results.activities.count > 0) {
      recommendation = '⚠️ Has activity but no balances - might be archived or cleared.';
    } else {
      recommendation = '⚠️ Has balances but no activity - might be new or not synced.';
    }

    res.json({
      success: true,
      ...results,
      recommendation,
      isCurrent: parseInt(profileId) === parseInt(WISE_PROFILE_ID),
      action: recommendation.includes('✅') && parseInt(profileId) !== parseInt(WISE_PROFILE_ID)
        ? `Update WISE_PROFILE_ID environment variable to ${profileId}`
        : null
    });

  } catch (error) {
    console.error('❌ Error testing profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/wise/debug/test-all-profiles
 * Test all available profiles and recommend which one to use
 */
router.get('/test-all-profiles', auth, async (req, res) => {
  try {
    if (!WISE_API_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'WISE_API_TOKEN environment variable is not set'
      });
    }

    console.log('🔍 Testing all profiles...');

    // Step 1: Get all profiles
    const profilesResponse = await fetch(`${WISE_API_URL}/v1/profiles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!profilesResponse.ok) {
      throw new Error(`Failed to fetch profiles: ${profilesResponse.status}`);
    }

    const profiles = await profilesResponse.json();
    console.log(`✓ Found ${profiles.length} profiles`);

    // Step 2: Test each profile
    const results = [];

    for (const profile of profiles) {
      console.log(`\n🔍 Testing profile ${profile.id}...`);

      const profileTest = {
        id: profile.id,
        type: profile.type,
        name: profile.type === 'personal'
          ? `${profile.details?.firstName || ''} ${profile.details?.lastName || ''}`.trim()
          : profile.details?.name || 'Business Account',
        hasActivity: false,
        activityCount: 0,
        balances: {},
        totalBalanceUSD: 0,
        recommendation: '',
        isCurrent: profile.id === parseInt(WISE_PROFILE_ID)
      };

      // Test activities
      try {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const activitiesResponse = await fetch(
          `${WISE_API_URL}/v1/profiles/${profile.id}/activities?` +
          `createdDateStart=${twoYearsAgo.toISOString()}&` +
          `limit=1000`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${WISE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (activitiesResponse.ok) {
          const data = await activitiesResponse.json();
          profileTest.activityCount = data.activities?.length || 0;
          profileTest.hasActivity = profileTest.activityCount > 0;
          console.log(`  Activities: ${profileTest.activityCount}`);
        }
      } catch (error) {
        console.log(`  Activities: ERROR - ${error.message}`);
      }

      // Test balances
      try {
        const balancesResponse = await fetch(
          `${WISE_API_URL}/v4/profiles/${profile.id}/balances?types=STANDARD`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${WISE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (balancesResponse.ok) {
          const balances = await balancesResponse.json();
          balances.forEach(balance => {
            profileTest.balances[balance.currency] = balance.amount.value;
            if (balance.currency === 'USD') {
              profileTest.totalBalanceUSD += balance.amount.value;
            }
          });
          console.log(`  Balances: ${Object.entries(profileTest.balances).map(([c, a]) => `${c}: ${a}`).join(', ')}`);
        }
      } catch (error) {
        console.log(`  Balances: ERROR - ${error.message}`);
      }

      // Generate recommendation
      if (profileTest.hasActivity && profileTest.totalBalanceUSD > 0) {
        profileTest.recommendation = '✅ USE THIS ONE - Has both activity and balances';
      } else if (profileTest.hasActivity) {
        profileTest.recommendation = '⚠️ Has activity but no USD balance';
      } else if (profileTest.totalBalanceUSD > 0) {
        profileTest.recommendation = '⚠️ Has balance but no activity';
      } else {
        profileTest.recommendation = '❌ Empty - skip this profile';
      }

      results.push(profileTest);
    }

    // Find recommended profile
    const recommended = results
      .filter(p => p.hasActivity)
      .sort((a, b) => b.activityCount - a.activityCount)[0];

    res.json({
      success: true,
      totalProfiles: profiles.length,
      currentProfileId: parseInt(WISE_PROFILE_ID) || null,
      recommendedProfileId: recommended?.id || null,
      profiles: results,
      summary: {
        withActivity: results.filter(p => p.hasActivity).length,
        withBalances: results.filter(p => p.totalBalanceUSD > 0).length,
        empty: results.filter(p => !p.hasActivity && p.totalBalanceUSD === 0).length
      },
      action: recommended && recommended.id !== parseInt(WISE_PROFILE_ID)
        ? `Update WISE_PROFILE_ID environment variable to ${recommended.id}`
        : recommended && recommended.id === parseInt(WISE_PROFILE_ID)
        ? '✅ Current profile is correct'
        : '❌ No profiles with activity found - check API token'
    });

  } catch (error) {
    console.error('❌ Error testing all profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
