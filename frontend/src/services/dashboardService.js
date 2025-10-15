import api from './api';

const dashboardService = {
  // Get comprehensive dashboard statistics
  async getStats() {
    const response = await api.get('/dashboard/stats');
    return response.data;
  }
};

export default dashboardService;
