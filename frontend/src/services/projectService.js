import api from './api';

const projectService = {
  /**
   * Get all projects
   * @param {string} status - Optional status filter ('active', 'on_hold', 'completed', 'archived', 'all')
   */
  async getAll(status = null) {
    const params = status && status !== 'all' ? { status } : {};
    const response = await api.get('/projects', { params });
    return response.data;
  },

  /**
   * Get single project by ID
   */
  async getById(id) {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  /**
   * Get project with employee details
   */
  async getWithEmployees(id) {
    const response = await api.get(`/projects/${id}/employees`);
    return response.data;
  },

  /**
   * Create new project
   */
  async create(project) {
    const response = await api.post('/projects', project);
    return response.data;
  },

  /**
   * Update existing project
   */
  async update(id, project) {
    const response = await api.put(`/projects/${id}`, project);
    return response.data;
  },

  /**
   * Delete project (hard delete - only if no employees)
   */
  async delete(id) {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },

  /**
   * Archive project (soft delete)
   */
  async archive(id) {
    const response = await api.post(`/projects/${id}/archive`);
    return response.data;
  },

  /**
   * Assign employee to project
   */
  async assignEmployee(projectId, employeeId, data = {}) {
    const response = await api.post(`/projects/${projectId}/employees`, {
      employeeId,
      ...data
    });
    return response.data;
  },

  /**
   * Remove employee from project
   */
  async removeEmployee(projectId, employeeId) {
    const response = await api.delete(`/projects/${projectId}/employees/${employeeId}`);
    return response.data;
  },

  /**
   * Get project statistics
   */
  async getStats() {
    const response = await api.get('/projects/stats');
    return response.data;
  }
};

export default projectService;
