const payrollModel = require('../models/payrollModel');

const payrollController = {
  /**
   * Get payroll summary
   */
  async getSummary(req, res, next) {
    try {
      const summary = await payrollModel.getSummary();
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = payrollController;
