const EntryModel = require('../models/entryModel');

const EntryController = {
  // GET /api/entries?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  async getAll(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const entries = await EntryModel.getAll({ startDate, endDate });
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
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.json(entry);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/entries
  async create(req, res, next) {
    try {
      const entry = await EntryModel.create(req.body);
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/entries/:id
  async update(req, res, next) {
    try {
      const entry = await EntryModel.update(req.params.id, req.body);
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
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
        return res.status(404).json({ error: 'Entry not found' });
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

  // GET /api/entries/income
  async getIncome(req, res, next) {
    try {
      const income = await EntryModel.getIncome();
      res.json(income);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/expenses
  async getExpenses(req, res, next) {
    try {
      const expenses = await EntryModel.getExpenses();
      res.json(expenses);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/entries/salaries
  async getSalaries(req, res, next) {
    try {
      const salaries = await EntryModel.getSalaries();
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

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty IDs array' });
      }

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

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty IDs array' });
      }

      if (!['completed', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be completed or pending' });
      }

      const result = await EntryModel.bulkUpdateStatus(ids, status);
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

module.exports = EntryController;
