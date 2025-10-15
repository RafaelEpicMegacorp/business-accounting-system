const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

router.get('/stats', DashboardController.getStats);
router.get('/chart-data', DashboardController.getChartData);
router.get('/category-breakdown', DashboardController.getCategoryBreakdown);

module.exports = router;
