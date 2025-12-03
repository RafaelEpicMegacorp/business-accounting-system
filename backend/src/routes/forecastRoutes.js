const express = require('express');
const router = express.Router();
const ForecastController = require('../controllers/forecastController');
const auth = require('../middleware/auth');

// All forecast routes require authentication
router.use(auth);

// GET /api/forecast/projection?months=3 - Get multi-month projection
router.get('/projection', ForecastController.getProjection);

// GET /api/forecast/recurring-expenses - Get detected recurring expenses
router.get('/recurring-expenses', ForecastController.getRecurringExpenses);

// GET /api/forecast/patterns - Get saved recurring expense patterns
router.get('/patterns', ForecastController.getSavedPatterns);

// POST /api/forecast/patterns - Save a recurring expense pattern
router.post('/patterns', ForecastController.savePattern);

// PUT /api/forecast/patterns/:id - Update a recurring expense pattern
router.put('/patterns/:id', ForecastController.updatePattern);

// DELETE /api/forecast/patterns/:id - Delete a recurring expense pattern
router.delete('/patterns/:id', ForecastController.deletePattern);

// GET /api/forecast/tax-settings - Get tax settings
router.get('/tax-settings', ForecastController.getTaxSettings);

// PUT /api/forecast/tax-settings - Update tax settings
router.put('/tax-settings', ForecastController.updateTaxSettings);

// POST /api/forecast/calculate-taxes - Calculate taxes for given amounts
router.post('/calculate-taxes', ForecastController.calculateTaxes);

module.exports = router;
