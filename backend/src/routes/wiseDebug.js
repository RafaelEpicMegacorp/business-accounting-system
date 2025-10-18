const express = require('express');
const router = express.Router();
const wiseService = require('../services/wiseService');

/**
 * Debug endpoint to test Wise API connection and SCA
 * GET /api/wise/debug/test-connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    console.log('=== WISE DEBUG TEST START ===');
    console.log('WISE_API_TOKEN configured:', !!process.env.WISE_API_TOKEN);
    console.log('WISE_PROFILE_ID:', process.env.WISE_PROFILE_ID);
    console.log('WISE_PRIVATE_KEY configured:', !!process.env.WISE_PRIVATE_KEY);
    console.log('WISE_PRIVATE_KEY format:', process.env.WISE_PRIVATE_KEY?.substring(0, 30) + '...');

    // Test 1: Get balance accounts
    console.log('\n--- Test 1: Get Balance Accounts ---');
    const balances = await wiseService.getBalanceAccounts();
    console.log(`✅ Got ${balances.length} balance accounts`);
    console.log('Balances:', balances.map(b => ({ id: b.id, currency: b.currency })));

    // Test 2: Try to get transactions for first balance
    if (balances.length > 0) {
      const balance = balances[0];
      console.log(`\n--- Test 2: Get Transactions for Balance ${balance.id} (${balance.currency}) ---`);

      // Test with last 30 days to ensure we get some transactions
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const today = new Date().toISOString();

      console.log(`Fetching transactions from ${thirtyDaysAgo} to ${today}`);

      try {
        const result = await wiseService.getBalanceTransactions(balance.id, balance.currency, {
          intervalStart: thirtyDaysAgo,
          intervalEnd: today
        });

        console.log(`✅ Got ${result.transactions?.length || 0} transactions`);
        if (result.transactions?.length > 0) {
          console.log('First transaction sample:', JSON.stringify(result.transactions[0], null, 2));
        } else {
          console.log('No transactions found in the last 30 days');
        }
      } catch (txError) {
        console.error('❌ Transaction fetch failed:', txError.message);
        console.error('Error details:', JSON.stringify(txError.response?.data || txError.message));
      }
    }

    console.log('=== WISE DEBUG TEST END ===');

    res.json({
      success: true,
      config: {
        hasApiToken: !!process.env.WISE_API_TOKEN,
        hasProfileId: !!process.env.WISE_PROFILE_ID,
        hasPrivateKey: !!process.env.WISE_PRIVATE_KEY,
        privateKeyFormat: process.env.WISE_PRIVATE_KEY?.substring(0, 30) + '...'
      },
      balances: balances.map(b => ({ id: b.id, currency: b.currency })),
      message: 'Check Railway logs for detailed output'
    });

  } catch (error) {
    console.error('=== WISE DEBUG TEST FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Response data:', error.response?.data);

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

module.exports = router;
