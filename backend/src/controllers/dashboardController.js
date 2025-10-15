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
  }
};

module.exports = DashboardController;
