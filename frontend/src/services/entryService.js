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

  // Get income entries only (with optional date filters)
  async getIncome(filters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString();
    const response = await api.get(`/entries/income${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },

  // Get non-employee expense entries (with optional date filters)
  async getExpenses(filters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString();
    const response = await api.get(`/entries/expenses${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },

  // Get salary entries only (with optional date filters)
  async getSalaries(filters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString();
    const response = await api.get(`/entries/salaries${queryString ? `?${queryString}` : ''}`);
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
  },

  // Generate missing salary entries for a given month
  async generateSalaryEntries(year, month) {
    const response = await api.post('/entries/generate-salary-entries', { year, month });
    return response.data;
  }
};

export default entryService;
