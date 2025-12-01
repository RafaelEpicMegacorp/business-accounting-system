import api from './api';

const positionService = {
  /**
   * Get all active positions
   */
  async getAll() {
    const response = await api.get('/positions');
    return response.data.data;
  },

  /**
   * Get single position by ID
   */
  async getById(id) {
    const response = await api.get(`/positions/${id}`);
    return response.data.data;
  },

  /**
   * Get employee counts by position
   */
  async getCounts() {
    const response = await api.get('/positions/counts');
    return response.data.data;
  },

  /**
   * Create new position
   */
  async create(position) {
    const response = await api.post('/positions', position);
    return response.data.data;
  },

  /**
   * Update existing position
   */
  async update(id, position) {
    const response = await api.put(`/positions/${id}`, position);
    return response.data.data;
  },

  /**
   * Delete position (soft delete)
   */
  async delete(id) {
    const response = await api.delete(`/positions/${id}`);
    return response.data.data;
  }
};

export default positionService;
