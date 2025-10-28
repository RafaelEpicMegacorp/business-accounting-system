import api from './api';

const wiseService = {
  /**
   * Manual sync from Wise API
   * Fetches activities and transfers from Wise and imports them
   */
  syncFromWise: async () => {
    try {
      const response = await api.post('/wise/sync');
      return response.data;
    } catch (error) {
      console.error('Error syncing from Wise:', error);
      throw error;
    }
  }
};

export default wiseService;
