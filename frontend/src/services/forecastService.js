import api from './api';

const forecastService = {
  /**
   * Get multi-month projection
   * @param {number} months - Number of months to project (1-12)
   * @returns {Promise<Object>} Projection data with monthly breakdowns
   */
  async getProjection(months = 3) {
    const response = await api.get('/forecast/projection', {
      params: { months }
    });
    return response.data;
  },

  /**
   * Get detected recurring expenses from historical data
   * @returns {Promise<Object>} { patterns, totalMonthlyRecurring }
   */
  async getRecurringExpenses() {
    const response = await api.get('/forecast/recurring-expenses');
    return response.data;
  },

  /**
   * Get saved recurring expense patterns
   * @returns {Promise<Array>} List of saved patterns
   */
  async getSavedPatterns() {
    const response = await api.get('/forecast/patterns');
    return response.data;
  },

  /**
   * Save a recurring expense pattern
   * @param {Object} pattern - Pattern data
   * @returns {Promise<Object>} Saved pattern
   */
  async savePattern(pattern) {
    const response = await api.post('/forecast/patterns', pattern);
    return response.data;
  },

  /**
   * Update a recurring expense pattern
   * @param {number} id - Pattern ID
   * @param {Object} data - Updated pattern data
   * @returns {Promise<Object>} Updated pattern
   */
  async updatePattern(id, data) {
    const response = await api.put(`/forecast/patterns/${id}`, data);
    return response.data;
  },

  /**
   * Delete a recurring expense pattern
   * @param {number} id - Pattern ID
   * @returns {Promise<Object>} Deletion result
   */
  async deletePattern(id) {
    const response = await api.delete(`/forecast/patterns/${id}`);
    return response.data;
  },

  /**
   * Get tax settings
   * @returns {Promise<Object>} Tax settings object
   */
  async getTaxSettings() {
    const response = await api.get('/forecast/tax-settings');
    return response.data;
  },

  /**
   * Update tax settings
   * @param {Object} settings - Key-value pairs of settings to update
   * @returns {Promise<Object>} Update result
   */
  async updateTaxSettings(settings) {
    const response = await api.put('/forecast/tax-settings', settings);
    return response.data;
  },

  /**
   * Calculate taxes for given amounts
   * @param {Object} params - { income, expenses, salaryExpenses }
   * @returns {Promise<Object>} Tax calculation result
   */
  async calculateTaxes(params) {
    const response = await api.post('/forecast/calculate-taxes', params);
    return response.data;
  }
};

export default forecastService;
