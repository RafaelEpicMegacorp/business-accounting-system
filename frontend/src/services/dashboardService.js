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
  },

  // Get expenses for a specific category
  async getExpensesByCategory(year, month, category) {
    const response = await api.get(`/dashboard/expenses/${encodeURIComponent(category)}`, {
      params: { year, month }
    });
    return response.data;
  },

  // Get top expenses for a month
  async getTopExpenses(year, month, limit = 10) {
    const response = await api.get('/dashboard/top-expenses', {
      params: { year, month, limit }
    });
    return response.data;
  },

  // Get vendor breakdown for a month
  async getVendorBreakdown(year, month) {
    const response = await api.get('/dashboard/vendor-breakdown', {
      params: { year, month }
    });
    return response.data;
  },

  // Get category comparison (this month vs last month)
  async getCategoryComparison(year, month) {
    const response = await api.get('/dashboard/category-comparison', {
      params: { year, month }
    });
    return response.data;
  }
};

export default dashboardService;
