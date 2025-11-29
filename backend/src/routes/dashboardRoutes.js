const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

router.get('/stats', DashboardController.getStats);
router.get('/chart-data', DashboardController.getChartData);
router.get('/category-breakdown', DashboardController.getCategoryBreakdown);
router.get('/monthly-stats', DashboardController.getMonthlyStats);
router.get('/expenses/:category', DashboardController.getExpensesByCategory);
router.get('/top-expenses', DashboardController.getTopExpenses);
router.get('/vendor-breakdown', DashboardController.getVendorBreakdown);
router.get('/category-comparison', DashboardController.getCategoryComparison);

module.exports = router;
