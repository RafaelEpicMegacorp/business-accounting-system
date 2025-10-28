const EntryModel = require('../models/entryModel');
const pool = require('../config/database');
const ApiError = require('../utils/ApiError');
const { validateEntryData, validateBulkOperation, validateStatus } = require('../utils/entryValidation');

const EntryController = {
  // GET /api/entries with optional filters
  // Query params: startDate, endDate, search, categories[], employeeId, minAmount, maxAmount, status, currency
  async getAll(req, res, next) {
    try {
      const {
        startDate,
        endDate,
        search,
        categories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      } = req.query;

      // Parse categories if provided (can be single or array)
      let parsedCategories;
      if (categories) {
        parsedCategories = Array.isArray(categories) ? categories : [categories];
      }

      const filters = {
        startDate,
        endDate,
        search,
        categories: parsedCategories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      };

      const entries = await EntryModel.getAll(filters);
      res.json(entries);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/:id
  async getById(req, res, next) {
    try {
      const entry = await EntryModel.getById(req.params.id);
      if (!entry) {
        throw ApiError.notFound('Entry not found');
      }
      res.json(entry);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/entries
  async create(req, res, next) {
    try {
      // Validate entry data
      await validateEntryData(req.body, false);

      const entry = await EntryModel.create(req.body);
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/entries/:id
  async update(req, res, next) {
    try {
      // Validate entry data (partial update allowed)
      await validateEntryData(req.body, true);

      const entry = await EntryModel.update(req.params.id, req.body);
      if (!entry) {
        throw ApiError.notFound('Entry not found');
      }
      res.json(entry);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/entries/:id
  async delete(req, res, next) {
    try {
      const entry = await EntryModel.delete(req.params.id);
      if (!entry) {
        throw ApiError.notFound('Entry not found');
      }
      res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/totals
  async getTotals(req, res, next) {
    try {
      const totals = await EntryModel.getTotals();
      res.json(totals);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/scheduled
  async getScheduled(req, res, next) {
    try {
      const scheduled = await EntryModel.getScheduled();
      res.json(scheduled);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/forecast
  async getForecast(req, res, next) {
    try {
      const forecast = await EntryModel.getForecast();
      res.json(forecast);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/income with optional filters
  async getIncome(req, res, next) {
    try {
      const {
        startDate,
        endDate,
        search,
        categories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      } = req.query;

      // Parse categories if provided
      let parsedCategories;
      if (categories) {
        parsedCategories = Array.isArray(categories) ? categories : [categories];
      }

      const filters = {
        startDate,
        endDate,
        search,
        categories: parsedCategories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      };

      const income = await EntryModel.getIncome(filters);
      res.json(income);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/expenses with optional filters
  async getExpenses(req, res, next) {
    try {
      const {
        startDate,
        endDate,
        search,
        categories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      } = req.query;

      // Parse categories if provided
      let parsedCategories;
      if (categories) {
        parsedCategories = Array.isArray(categories) ? categories : [categories];
      }

      const filters = {
        startDate,
        endDate,
        search,
        categories: parsedCategories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      };

      const expenses = await EntryModel.getExpenses(filters);
      res.json(expenses);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/salaries with optional filters
  async getSalaries(req, res, next) {
    try {
      const {
        startDate,
        endDate,
        search,
        categories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      } = req.query;

      // Parse categories if provided
      let parsedCategories;
      if (categories) {
        parsedCategories = Array.isArray(categories) ? categories : [categories];
      }

      const filters = {
        startDate,
        endDate,
        search,
        categories: parsedCategories,
        employeeId,
        minAmount,
        maxAmount,
        status,
        currency
      };

      const salaries = await EntryModel.getSalaries(filters);
      res.json(salaries);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/entries/generate-salary-entries
  async generateSalaryEntries(req, res, next) {
    try {
      const { year, month } = req.body;

      // Default to current month if not provided
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month || (now.getMonth() + 1);

      const result = await EntryModel.generateMissingSalaryEntries(targetYear, targetMonth);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/entries/bulk
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;

      // Validate bulk operation data
      validateBulkOperation(ids);

      const result = await EntryModel.bulkDelete(ids);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/entries/bulk/status
  async bulkUpdateStatus(req, res, next) {
    try {
      const { ids, status } = req.body;

      // Validate bulk operation data and status
      validateBulkOperation(ids);
      validateStatus(status);

      const result = await EntryModel.bulkUpdateStatus(ids, status);
      res.json({
        success: true,
        affected: result.affected,
        failed: result.failed
      });
    } catch (error) {
      next(error);
    }
  },

  // POST /api/entries/cleanup-weekly
  async cleanupWeeklyEntries(req, res, next) {
    try {
      // Check what entries we'll delete
      const checkResult = await pool.query(`
        SELECT e.id, e.description, e.entry_date, e.total, emp.name
        FROM entries e
        JOIN employees emp ON e.employee_id = emp.id
        WHERE emp.pay_type = 'weekly'
        AND e.category = 'Employee'
        AND EXTRACT(DOW FROM e.entry_date) = 0
        ORDER BY emp.name, e.entry_date
      `);

      const entriesToDelete = checkResult.rows;

      // Delete the incorrect Sunday entries
      const deleteResult = await pool.query(`
        DELETE FROM entries
        WHERE id IN (
          SELECT e.id FROM entries e
          JOIN employees emp ON e.employee_id = emp.id
          WHERE emp.pay_type = 'weekly'
          AND e.category = 'Employee'
          AND EXTRACT(DOW FROM e.entry_date) = 0
        )
        RETURNING id
      `);

      res.json({
        success: true,
        deleted: deleteResult.rows.length,
        entries: entriesToDelete,
        message: 'Successfully cleaned up Sunday entries for weekly employees. Visit Salaries tab to regenerate correct entries.'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = EntryController;
