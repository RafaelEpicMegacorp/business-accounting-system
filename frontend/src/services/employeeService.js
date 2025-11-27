import api from './api';

const employeeService = {
  // Get all employees (with optional active filter)
  async getAll(isActive = null) {
    const params = isActive !== null ? { active: isActive } : {};
    const response = await api.get('/employees', { params });
    return response.data;
  },

  // Get single employee
  async getById(id) {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  // Get employee with their projects
  async getWithProjects(id) {
    const response = await api.get(`/employees/${id}/projects`);
    return response.data;
  },

  // Create employee
  async create(employee) {
    const response = await api.post('/employees', {
      name: employee.name,
      email: employee.email || null,
      position: employee.position || null,
      payType: employee.payType,
      payRate: parseFloat(employee.payRate),
      payMultiplier: parseFloat(employee.payMultiplier || 1.0),
      startDate: employee.startDate || new Date().toISOString().split('T')[0]
    });
    return response.data;
  },

  // Update employee
  async update(id, employee) {
    const response = await api.put(`/employees/${id}`, {
      name: employee.name,
      email: employee.email || null,
      position: employee.position || null,
      payType: employee.payType,
      payRate: parseFloat(employee.payRate),
      payMultiplier: parseFloat(employee.payMultiplier || 1.0),
      startDate: employee.startDate
    });
    return response.data;
  },

  // Calculate severance pay
  async calculateSeverance(id, terminationDate) {
    const response = await api.post(`/employees/${id}/calculate-severance`, {
      terminationDate: terminationDate || new Date().toISOString().split('T')[0]
    });
    return response.data;
  },

  // Calculate severance pay with preview (doesn't save to DB)
  async calculateSeverancePreview(id, terminationDate, overrides = {}) {
    const response = await api.post(`/employees/${id}/calculate-severance-preview`, {
      terminationDate: terminationDate || new Date().toISOString().split('T')[0],
      ...overrides
    });
    return response.data;
  },

  // Terminate employee with optional entry creation
  async terminate(id, terminationDate, createEntry = false) {
    const response = await api.post(`/employees/${id}/terminate`, {
      terminationDate: terminationDate || new Date().toISOString().split('T')[0],
      createEntry
    });
    return response.data;
  },

  // Reactivate employee
  async reactivate(id) {
    const response = await api.post(`/employees/${id}/reactivate`);
    return response.data;
  },

  // Delete employee (hard delete)
  async delete(id) {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },

  // Bulk delete employees
  async bulkDelete(ids) {
    const response = await api.delete('/employees/bulk', { data: { ids } });
    return response.data;
  },

  // Bulk terminate employees
  async bulkTerminate(ids, terminationDate) {
    const response = await api.post('/employees/bulk/terminate', {
      ids,
      terminationDate: terminationDate || new Date().toISOString().split('T')[0]
    });
    return response.data;
  },

  // Bulk reactivate employees
  async bulkReactivate(ids) {
    const response = await api.post('/employees/bulk/reactivate', { ids });
    return response.data;
  }
};

export default employeeService;
