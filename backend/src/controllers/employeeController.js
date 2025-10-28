const EmployeeModel = require('../models/employeeModel');
const ApiError = require('../utils/ApiError');
const { validateEmployeeData, validateBulkOperation, validateTerminationData } = require('../utils/employeeValidation');

const EmployeeController = {
  // Get all employees
  async getAll(req, res, next) {
    try {
      const { active } = req.query;
      const isActive = active === 'true' ? true : active === 'false' ? false : null;
      const employees = await EmployeeModel.getAllWithStats(isActive);
      res.json(employees);
    } catch (error) {
      next(error);
    }
  },

  // Get single employee
  async getById(req, res, next) {
    try {
      const employee = await EmployeeModel.getWithStats(req.params.id);
      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }
      res.json(employee);
    } catch (error) {
      next(error);
    }
  },

  // Create employee
  async create(req, res, next) {
    try {
      // Validate employee data
      await validateEmployeeData(req.body, false);

      const employee = await EmployeeModel.create(req.body);
      res.status(201).json(employee);
    } catch (error) {
      next(error);
    }
  },

  // Update employee
  async update(req, res, next) {
    try {
      // Validate employee data (partial update allowed)
      await validateEmployeeData(req.body, true, req.params.id);

      const employee = await EmployeeModel.update(req.params.id, req.body);
      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }
      res.json(employee);
    } catch (error) {
      next(error);
    }
  },

  // Calculate severance pay
  async calculateSeverance(req, res, next) {
    try {
      // Validate termination data
      validateTerminationData(req.body);

      const severance = await EmployeeModel.calculateSeverance(req.params.id, req.body.terminationDate);
      res.json(severance);
    } catch (error) {
      next(error);
    }
  },

  // Terminate employee with optional severance entry creation
  async terminate(req, res, next) {
    try {
      const { terminationDate, createEntry } = req.body;

      // Validate termination data
      validateTerminationData(req.body);

      // Calculate severance first
      const severance = await EmployeeModel.calculateSeverance(req.params.id, terminationDate);

      // Terminate the employee
      const employee = await EmployeeModel.terminate(req.params.id, terminationDate);
      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }

      // Optionally create entry for severance payment
      let entry = null;
      if (createEntry) {
        const EntryModel = require('../models/entryModel');
        entry = await EntryModel.create({
          type: 'expense',
          category: 'Employee',
          description: employee.name,
          detail: `Severance payment (${severance.period_description})`,
          baseAmount: severance.base_severance,
          total: severance.total_severance,
          entryDate: terminationDate,
          status: 'pending',
          employeeId: employee.id
        });
      }

      res.json({
        employee,
        severance,
        entry: entry || null
      });
    } catch (error) {
      next(error);
    }
  },

  // Reactivate employee
  async reactivate(req, res, next) {
    try {
      const employee = await EmployeeModel.reactivate(req.params.id);
      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }
      res.json(employee);
    } catch (error) {
      next(error);
    }
  },

  // Delete employee (hard delete)
  async delete(req, res, next) {
    try {
      const employee = await EmployeeModel.delete(req.params.id);
      if (!employee) {
        throw ApiError.notFound('Employee not found');
      }
      res.json({ message: 'Employee deleted successfully', employee });
    } catch (error) {
      next(error);
    }
  },

  // Bulk delete employees
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;

      // Validate bulk operation data
      validateBulkOperation(ids);

      const result = await EmployeeModel.bulkDelete(ids);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      next(error);
    }
  },

  // Bulk terminate employees
  async bulkTerminate(req, res, next) {
    try {
      const { ids, terminationDate } = req.body;

      // Validate bulk operation data and termination date
      validateBulkOperation(ids);
      validateTerminationData({ terminationDate });

      const result = await EmployeeModel.bulkTerminate(ids, terminationDate);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      next(error);
    }
  },

  // Bulk reactivate employees
  async bulkReactivate(req, res, next) {
    try {
      const { ids } = req.body;

      // Validate bulk operation data
      validateBulkOperation(ids);

      const result = await EmployeeModel.bulkReactivate(ids);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = EmployeeController;
