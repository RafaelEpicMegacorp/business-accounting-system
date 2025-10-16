const express = require('express');
const router = express.Router();
const wiseWebhookController = require('../controllers/wiseWebhookController');

/**
 * Wise Integration Routes
 * Webhook endpoints and management API
 */

// Webhook endpoint (public, no auth required)
router.post('/webhook', wiseWebhookController.handleWebhook.bind(wiseWebhookController));

// Management endpoints (would add auth middleware in production)
router.get('/status', wiseWebhookController.getStatus.bind(wiseWebhookController));
router.get('/events', wiseWebhookController.getEvents.bind(wiseWebhookController));
router.post('/process-pending', wiseWebhookController.processPending.bind(wiseWebhookController));
router.post('/config', wiseWebhookController.updateConfig.bind(wiseWebhookController));
router.get('/balances', wiseWebhookController.getBalances.bind(wiseWebhookController));

module.exports = router;
