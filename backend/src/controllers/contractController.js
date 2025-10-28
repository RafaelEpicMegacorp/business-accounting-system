const ContractModel = require('../models/contractModel');
const ApiError = require('../utils/ApiError');
const { validateContractData } = require('../utils/contractValidation');

const ContractController = {
  // GET /api/contracts
  async getAll(req, res, next) {
    try {
      const contracts = await ContractModel.getAll();
      res.json(contracts);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/contracts/active
  async getActive(req, res, next) {
    try {
      const contracts = await ContractModel.getActive();
      res.json(contracts);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/contracts/:id
  async getById(req, res, next) {
    try {
      const contract = await ContractModel.getById(req.params.id);
      if (!contract) {
        throw ApiError.notFound('Contract not found');
      }
      res.json(contract);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/contracts
  async create(req, res, next) {
    try {
      // Validate contract data
      validateContractData(req.body, false);

      const contract = await ContractModel.create(req.body);
      res.status(201).json(contract);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/contracts/:id
  async update(req, res, next) {
    try {
      // Validate contract data (partial update allowed)
      validateContractData(req.body, true);

      const contract = await ContractModel.update(req.params.id, req.body);
      if (!contract) {
        throw ApiError.notFound('Contract not found');
      }
      res.json(contract);
    } catch (error) {
      next(error);
    }
  },

  // DELETE /api/contracts/:id
  async delete(req, res, next) {
    try {
      const contract = await ContractModel.delete(req.params.id);
      if (!contract) {
        throw ApiError.notFound('Contract not found');
      }
      res.json({ message: 'Contract deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/contracts/stats/revenue
  async getRevenue(req, res, next) {
    try {
      const revenue = await ContractModel.getRecurringRevenue();
      res.json({ monthly_recurring_revenue: revenue });
    } catch (error) {
      next(error);
    }
  },

  // POST /api/contracts/:id/generate-entries
  async generateEntries(req, res, next) {
    try {
      const generation = await ContractModel.generateEntries(req.params.id);
      res.json({
        success: true,
        entriesGenerated: generation.generated,
        paymentDates: generation.dates
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = ContractController;
