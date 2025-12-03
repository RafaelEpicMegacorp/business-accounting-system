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
  }
};

export default settingsService;
