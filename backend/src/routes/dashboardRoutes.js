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

module.exports = router;
