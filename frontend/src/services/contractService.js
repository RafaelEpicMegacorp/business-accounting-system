import api from './api';

const contractService = {
  // Get all contracts
  async getAll() {
    const response = await api.get('/contracts');
    return response.data;
  },

  // Get active contracts only
  async getActive() {
    const response = await api.get('/contracts/active');
    return response.data;
  },

  // Get contract by ID
  async getById(id) {
    const response = await api.get(`/contracts/${id}`);
    return response.data;
  },

  // Create new contract
  async create(contract) {
    const response = await api.post('/contracts', contract);
    return response.data;
  },

  // Update contract
  async update(id, contract) {
    const response = await api.put(`/contracts/${id}`, contract);
    return response.data;
  },

  // Delete contract
  async delete(id) {
    const response = await api.delete(`/contracts/${id}`);
    return response.data;
  },

  // Get monthly recurring revenue
  async getRevenue() {
    const response = await api.get('/contracts/stats/revenue');
    return response.data;
  },

  // Generate income entries for a contract
  async generateEntries(id) {
    const response = await api.post(`/contracts/${id}/generate-entries`);
    return response.data;
  }
};

export default contractService;
