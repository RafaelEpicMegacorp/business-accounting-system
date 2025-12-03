const ForecastModel = require('../models/forecastModel');

const ForecastController = {
  /**
   * Get multi-month projection
   * GET /api/forecast/projection?months=3
   */
  async getProjection(req, res, next) {
    try {
      const months = Math.min(Math.max(parseInt(req.query.months) || 3, 1), 12);
      const projection = await ForecastModel.getProjection(months);
      res.json(projection);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get detected recurring expenses
   * GET /api/forecast/recurring-expenses
   */
  async getRecurringExpenses(req, res, next) {
    try {
      const recurringExpenses = await ForecastModel.detectRecurringExpenses();
      res.json(recurringExpenses);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get saved recurring expense patterns
   * GET /api/forecast/patterns
   */
  async getSavedPatterns(req, res, next) {
    try {
      const patterns = await ForecastModel.getSavedPatterns();
      res.json(patterns);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Save a recurring expense pattern
   * POST /api/forecast/patterns
   */
  async savePattern(req, res, next) {
    try {
      const pattern = await ForecastModel.savePattern(req.body);
      res.status(201).json(pattern);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update a recurring expense pattern
   * PUT /api/forecast/patterns/:id
   */
  async updatePattern(req, res, next) {
    try {
      const pattern = await ForecastModel.updatePattern(req.params.id, req.body);
      if (!pattern) {
        return res.status(404).json({ error: 'Pattern not found' });
      }
      res.json(pattern);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a recurring expense pattern
   * DELETE /api/forecast/patterns/:id
   */
  async deletePattern(req, res, next) {
    try {
      const pattern = await ForecastModel.deletePattern(req.params.id);
      if (!pattern) {
        return res.status(404).json({ error: 'Pattern not found' });
      }
      res.json({ success: true, message: 'Pattern deleted', pattern });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get tax settings
   * GET /api/forecast/tax-settings
   */
  async getTaxSettings(req, res, next) {
    try {
      const settings = await ForecastModel.getTaxSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update tax settings
   * PUT /api/forecast/tax-settings
   */
  async updateTaxSettings(req, res, next) {
    try {
      const updates = await ForecastModel.updateTaxSettings(req.body);
      res.json({
        success: true,
        message: 'Tax settings updated',
        updated: updates.length
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Calculate taxes for given amounts
   * POST /api/forecast/calculate-taxes
   */
  async calculateTaxes(req, res, next) {
    try {
      const { income, expenses, salaryExpenses } = req.body;

      if (income === undefined && expenses === undefined) {
        return res.status(400).json({
          error: 'At least income or expenses must be provided'
        });
      }

      const taxSettings = await ForecastModel.getTaxSettings();
      const taxes = ForecastModel.calculateTaxes(
        { income, expenses, salaryExpenses },
        taxSettings
      );

      res.json(taxes);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = ForecastController;
