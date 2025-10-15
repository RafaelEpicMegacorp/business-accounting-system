const DashboardModel = require('../models/dashboardModel');

const DashboardController = {
  // GET /api/dashboard/stats
  async getStats(req, res, next) {
    try {
      const stats = await DashboardModel.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/dashboard/chart-data?months=12
  async getChartData(req, res, next) {
    try {
      const months = parseInt(req.query.months) || 12;
      const data = await DashboardModel.getChartData(months);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/dashboard/category-breakdown?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  async getCategoryBreakdown(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const data = await DashboardModel.getCategoryBreakdown(startDate, endDate);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = DashboardController;
