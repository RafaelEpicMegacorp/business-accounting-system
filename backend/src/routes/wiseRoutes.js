const express = require('express');
const router = express.Router();
const wiseWebhookController = require('../controllers/wiseWebhookController');
const authMiddleware = require('../middleware/auth');

// Public webhook endpoint (no auth, but signature validated)
// POST /api/wise/webhook
router.post('/webhook', wiseWebhookController.handleWebhook);

// GET endpoint for webhook validation (used by Wise during registration)
// GET /api/wise/webhook
// Wise expects empty response body during validation
router.get('/webhook', (req, res) => {
  res.status(200).set('Content-Type', 'text/plain').end();
});

// Protected routes (require authentication)

// Manual sync of transactions
// GET /api/wise/sync?days=7
router.get('/sync', authMiddleware, wiseWebhookController.manualSync);

// Get transactions pending review
// GET /api/wise/pending-review
router.get('/pending-review', authMiddleware, wiseWebhookController.getPendingReview);

// Get sync statistics
// GET /api/wise/stats
router.get('/stats', authMiddleware, wiseWebhookController.getStats);

// Review/approve a transaction
// POST /api/wise/review/:id
// Body: { action: 'approve' | 'skip', category?: string, employeeId?: number }
router.post('/review/:id', authMiddleware, wiseWebhookController.reviewTransaction);

// Get diagnostic information
// GET /api/wise/diagnostics
router.get('/diagnostics', authMiddleware, wiseWebhookController.getDiagnostics);

// Test Wise API connection
// GET /api/wise/test-connection
router.get('/test-connection', authMiddleware, wiseWebhookController.testConnection);

// DEBUG endpoint - Get raw API response for balance statement
// GET /api/wise/debug-statement?balanceId=134500343&currency=USD
router.get('/debug-statement', authMiddleware, async (req, res, next) => {
  try {
    const wiseService = require('../services/wiseService');
    const { balanceId, currency } = req.query;

    if (!balanceId || !currency) {
      return res.status(400).json({
        error: 'Missing required parameters',
        hint: 'Provide balanceId and currency query parameters'
      });
    }

    console.log(`[DEBUG ENDPOINT] Fetching statement for balance ${balanceId} (${currency})`);

    const result = await wiseService.getBalanceTransactions(balanceId, currency, {
      intervalStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      intervalEnd: new Date().toISOString(),
      type: 'COMPACT'
    });

    res.json({
      success: true,
      balanceId,
      currency,
      responseType: typeof result,
      isArray: Array.isArray(result),
      keys: Object.keys(result),
      hasTransactionsProperty: 'transactions' in result,
      transactionsCount: result.transactions ? result.transactions.length : 'N/A',
      fullResponse: result
    });

  } catch (error) {
    console.error('[DEBUG ENDPOINT] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
