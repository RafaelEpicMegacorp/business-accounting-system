import api from './api';

const dashboardService = {
  // Get comprehensive dashboard statistics
  async getStats() {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  // Get monthly statistics for a specific month
  async getMonthlyStats(year, month) {
    const response = await api.get('/dashboard/monthly-stats', {
      params: { year, month }
    });
    return response.data;
  },

  // Get category breakdown with date filters
  async getCategoryBreakdown(startDate, endDate) {
    const response = await api.get('/dashboard/category-breakdown', {
      params: { startDate, endDate }
    });
    return response.data;
  }
};

export default dashboardService;
