import api from './api';

const payrollService = {
  /**
   * Get payroll summary with per-project and per-employee breakdowns
   */
  async getSummary() {
    const response = await api.get('/payroll/summary');
    return response.data;
  }
};

export default payrollService;
