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

// Test Wise API connection
// GET /api/wise/test-connection
router.get('/test-connection', authMiddleware, wiseWebhookController.testConnection);

module.exports = router;
