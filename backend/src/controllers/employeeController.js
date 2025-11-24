const EmployeeModel = require('../models/employeeModel');

const EmployeeController = {
  // Get all employees
  async getAll(req, res) {
    try {
      const { active } = req.query;
      const isActive = active === 'true' ? true : active === 'false' ? false : null;
      const employees = await EmployeeModel.getAllWithStats(isActive);
      res.json(employees);
    } catch (error) {
      console.error('Get all employees error:', error);
      res.status(500).json({ error: 'Failed to retrieve employees' });
    }
  },

  // Get single employee
  async getById(req, res) {
    try {
      const employee = await EmployeeModel.getWithStats(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json(employee);
    } catch (error) {
      console.error('Get employee error:', error);
      res.status(500).json({ error: 'Failed to retrieve employee' });
    }
  },

  // Create employee
  async create(req, res) {
    try {
      const employee = await EmployeeModel.create(req.body);
      res.status(201).json(employee);
    } catch (error) {
      console.error('Create employee error:', error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'Employee with this email already exists' });
      }
      res.status(500).json({ error: 'Failed to create employee' });
    }
  },

  // Update employee
  async update(req, res) {
    try {
      const employee = await EmployeeModel.update(req.params.id, req.body);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json(employee);
    } catch (error) {
      console.error('Update employee error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Employee with this email already exists' });
      }
      res.status(500).json({ error: 'Failed to update employee' });
    }
  },

  // Calculate severance pay
  async calculateSeverance(req, res) {
    try {
      const { terminationDate } = req.body;
      if (!terminationDate) {
        return res.status(400).json({ error: 'Termination date is required' });
      }
      const severance = await EmployeeModel.calculateSeverance(req.params.id, terminationDate);
      res.json(severance);
    } catch (error) {
      console.error('Calculate severance error:', error);
      res.status(500).json({ error: error.message || 'Failed to calculate severance' });
    }
  },

  // Calculate severance pay with preview overrides (doesn't save to DB)
  async calculateSeverancePreview(req, res) {
    try {
      const { terminationDate, payType, payRate, payMultiplier, startDate } = req.body;
      if (!terminationDate) {
        return res.status(400).json({ error: 'Termination date is required' });
      }
      const overrides = { payType, payRate, payMultiplier, startDate };
      const severance = await EmployeeModel.calculateSeveranceWithOverrides(
        req.params.id,
        terminationDate,
        overrides
      );
      res.json(severance);
    } catch (error) {
      console.error('Calculate severance preview error:', error);
      res.status(500).json({ error: error.message || 'Failed to calculate severance preview' });
    }
  },

  // Terminate employee with optional severance entry creation
  async terminate(req, res) {
    try {
      const { terminationDate, createEntry } = req.body;

      // Calculate severance first
      const severance = await EmployeeModel.calculateSeverance(req.params.id, terminationDate);

      // Terminate the employee
      const employee = await EmployeeModel.terminate(req.params.id, terminationDate);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
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
      console.error('Terminate employee error:', error);
      res.status(500).json({ error: 'Failed to terminate employee' });
    }
  },

  // Reactivate employee
  async reactivate(req, res) {
    try {
      const employee = await EmployeeModel.reactivate(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json(employee);
    } catch (error) {
      console.error('Reactivate employee error:', error);
      res.status(500).json({ error: 'Failed to reactivate employee' });
    }
  },

  // Delete employee (hard delete)
  async delete(req, res) {
    try {
      const employee = await EmployeeModel.delete(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json({ message: 'Employee deleted successfully', employee });
    } catch (error) {
      console.error('Delete employee error:', error);
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({ error: 'Cannot delete employee with existing entries. Terminate instead.' });
      }
      res.status(500).json({ error: 'Failed to delete employee' });
    }
  },

  // Bulk delete employees
  async bulkDelete(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty IDs array' });
      }

      const result = await EmployeeModel.bulkDelete(ids);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      console.error('Bulk delete employees error:', error);
      res.status(500).json({ error: 'Failed to delete employees' });
    }
  },

  // Bulk terminate employees
  async bulkTerminate(req, res) {
    try {
      const { ids, terminationDate } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty IDs array' });
      }

      if (!terminationDate) {
        return res.status(400).json({ error: 'Termination date is required' });
      }

      const result = await EmployeeModel.bulkTerminate(ids, terminationDate);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      console.error('Bulk terminate employees error:', error);
      res.status(500).json({ error: 'Failed to terminate employees' });
    }
  },

  // Bulk reactivate employees
  async bulkReactivate(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty IDs array' });
      }

      const result = await EmployeeModel.bulkReactivate(ids);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      console.error('Bulk reactivate employees error:', error);
      res.status(500).json({ error: 'Failed to reactivate employees' });
    }
  }
};

module.exports = EmployeeController;
