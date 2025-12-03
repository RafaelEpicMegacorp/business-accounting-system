import api from './api';

const classificationService = {
  /**
   * Get all classifications
   */
  async getAll(format = 'flat') {
    const response = await api.get(`/classifications?format=${format}`);
    return response.data;
  },

  /**
   * Get classifications as hierarchy
   */
  async getHierarchy() {
    const response = await api.get('/classifications?format=hierarchy');
    return response.data;
  },

  /**
   * Get classification by ID
   */
  async getById(id) {
    const response = await api.get(`/classifications/${id}`);
    return response.data;
  },

  /**
   * Create a new classification
   */
  async create(data) {
    const response = await api.post('/classifications', data);
    return response.data;
  },

  /**
   * Update a classification
   */
  async update(id, data) {
    const response = await api.put(`/classifications/${id}`, data);
    return response.data;
  },

  /**
   * Delete a classification
   */
  async delete(id) {
    const response = await api.delete(`/classifications/${id}`);
    return response.data;
  },

  /**
   * Search classifications
   */
  async search(query) {
    const response = await api.get(`/classifications/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // ============================================
  // Suggestion Methods
  // ============================================

  /**
   * Get pending AI suggestions
   */
  async getPendingSuggestions() {
    const response = await api.get('/classifications/suggestions/pending');
    return response.data;
  },

  /**
   * Get suggestion history
   */
  async getSuggestionHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.from_date) params.append('from_date', filters.from_date);
    if (filters.to_date) params.append('to_date', filters.to_date);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const response = await api.get(`/classifications/suggestions/history?${params.toString()}`);
    return response.data;
  },

  /**
   * Get suggestion statistics
   */
  async getSuggestionStats() {
    const response = await api.get('/classifications/suggestions/stats');
    return response.data;
  },

  /**
   * Accept a suggestion
   */
  async acceptSuggestion(id, modifications = null) {
    const response = await api.post(`/classifications/suggestions/${id}/accept`, modifications || {});
    return response.data;
  },

  /**
   * Reject a suggestion
   */
  async rejectSuggestion(id, reason = null) {
    const response = await api.post(`/classifications/suggestions/${id}/reject`, { reason });
    return response.data;
  },

  /**
   * Modify and accept a suggestion
   */
  async modifySuggestion(id, modifications) {
    const response = await api.put(`/classifications/suggestions/${id}`, modifications);
    return response.data;
  },

  /**
   * Bulk accept suggestions
   */
  async bulkAcceptSuggestions(ids) {
    const response = await api.post('/classifications/suggestions/bulk-accept', { ids });
    return response.data;
  },

  /**
   * Bulk reject suggestions
   */
  async bulkRejectSuggestions(ids, reason = null) {
    const response = await api.post('/classifications/suggestions/bulk-reject', { ids, reason });
    return response.data;
  }
};

export default classificationService;
