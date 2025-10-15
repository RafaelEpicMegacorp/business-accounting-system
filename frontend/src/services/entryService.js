import api from './api';

const entryService = {
  // Get all entries
  async getAll() {
    const response = await api.get('/entries');
    return response.data;
  },

  // Get single entry
  async getById(id) {
    const response = await api.get(`/entries/${id}`);
    return response.data;
  },

  // Create entry with date and status support
  async create(entry) {
    const response = await api.post('/entries', {
      type: entry.type,
      category: entry.category,
      description: entry.description,
      detail: entry.detail,
      baseAmount: parseFloat(entry.baseAmount),
      total: parseFloat(entry.total),
      entryDate: entry.entryDate || new Date().toISOString().split('T')[0],
      status: entry.status || 'completed'
    });
    return response.data;
  },

  // Update entry with date and status support
  async update(id, entry) {
    const response = await api.put(`/entries/${id}`, {
      type: entry.type,
      category: entry.category,
      description: entry.description,
      detail: entry.detail,
      baseAmount: parseFloat(entry.baseAmount),
      total: parseFloat(entry.total),
      entryDate: entry.entryDate,
      status: entry.status || 'completed'
    });
    return response.data;
  },

  // Delete entry
  async delete(id) {
    const response = await api.delete(`/entries/${id}`);
    return response.data;
  },

  // Get totals (includes pending amounts)
  async getTotals() {
    const response = await api.get('/entries/totals');
    return response.data;
  },

  // Get scheduled/pending entries
  async getScheduled() {
    const response = await api.get('/entries/scheduled');
    return response.data;
  },

  // Get end-of-month forecast
  async getForecast() {
    const response = await api.get('/entries/forecast');
    return response.data;
  },

  // Get income entries only
  async getIncome() {
    const response = await api.get('/entries/income');
    return response.data;
  },

  // Get non-employee expense entries
  async getExpenses() {
    const response = await api.get('/entries/expenses');
    return response.data;
  },

  // Get salary entries only
  async getSalaries() {
    const response = await api.get('/entries/salaries');
    return response.data;
  },

  // Bulk delete entries
  async bulkDelete(ids) {
    const response = await api.delete('/entries/bulk', { data: { ids } });
    return response.data;
  },

  // Bulk update status
  async bulkUpdateStatus(ids, status) {
    const response = await api.put('/entries/bulk/status', { ids, status });
    return response.data;
  }
};

export default entryService;
