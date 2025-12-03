import api from './api';

const settingsService = {
  /**
   * Get all settings
   */
  async getAll() {
    const response = await api.get('/settings');
    return response.data;
  },

  /**
   * Get OpenAI configuration
   */
  async getOpenAIConfig() {
    const response = await api.get('/settings/openai');
    return response.data;
  },

  /**
   * Save OpenAI configuration
   */
  async saveOpenAIConfig(config) {
    const response = await api.post('/settings/openai', config);
    return response.data;
  },

  /**
   * Test OpenAI connection
   */
  async testConnection(apiKey) {
    const response = await api.post('/settings/openai/test', { apiKey });
    return response.data;
  },

  /**
   * Analyze expenses with OpenAI
   */
  async analyzeExpenses() {
    const response = await api.post('/settings/openai/analyze');
    return response.data;
  },

  /**
   * Clear LLM cache
   */
  async clearCache() {
    const response = await api.delete('/settings/cache');
    return response.data;
  },

  // ============================================
  // Decision History & Learning Methods
  // ============================================

  /**
   * Get decision history with pagination and filtering
   */
  async getDecisionHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.decision) params.append('decision', filters.decision);
    if (filters.from_date) params.append('from_date', filters.from_date);
    if (filters.to_date) params.append('to_date', filters.to_date);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const queryString = params.toString();
    const url = `/classifications/decisions/history${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  /**
   * Get decision statistics
   */
  async getDecisionStats() {
    const response = await api.get('/classifications/decisions/stats');
    return response.data;
  },

  /**
   * Get learning context (what AI learns from decisions)
   */
  async getLearningContext() {
    const response = await api.get('/classifications/decisions/learning-context');
    return response.data;
  },

  /**
   * Clear rejected decision history
   */
  async clearRejectedHistory(description = null) {
    const response = await api.delete('/classifications/decisions/rejected', {
      data: description ? { description } : {}
    });
    return response.data;
  }
};

export default settingsService;
