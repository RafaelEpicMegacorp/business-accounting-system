const express = require('express');
const router = express.Router();
const CurrencyModel = require('../models/currencyModel');

// Get all currency balances
router.get('/balances', async (req, res) => {
  try {
    const balances = await CurrencyModel.getCurrencyBalances();
    res.json(balances);
  } catch (error) {
    console.error('Error getting currency balances:', error);
    res.status(500).json({ error: 'Failed to get currency balances' });
  }
});

// Get currency summary (balances + income/expense totals)
router.get('/summary', async (req, res) => {
  try {
    const summary = await CurrencyModel.getCurrencySummary();
    res.json(summary);
  } catch (error) {
    console.error('Error getting currency summary:', error);
    res.status(500).json({ error: 'Failed to get currency summary' });
  }
});

// Get balance for specific currency
router.get('/balances/:currency', async (req, res) => {
  try {
    const { currency } = req.params;
    const balance = await CurrencyModel.getBalanceByCurrency(currency.toUpperCase());

    if (!balance) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    res.json(balance);
  } catch (error) {
    console.error('Error getting currency balance:', error);
    res.status(500).json({ error: 'Failed to get currency balance' });
  }
});

// Get currency exchanges
router.get('/exchanges', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const exchanges = await CurrencyModel.getCurrencyExchanges(limit);
    res.json(exchanges);
  } catch (error) {
    console.error('Error getting currency exchanges:', error);
    res.status(500).json({ error: 'Failed to get currency exchanges' });
  }
});

// Get Wise entries for specific currency
router.get('/entries/:currency', async (req, res) => {
  try {
    const { currency } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const entries = await CurrencyModel.getWiseEntriesByCurrency(currency.toUpperCase(), limit);
    res.json(entries);
  } catch (error) {
    console.error('Error getting Wise entries:', error);
    res.status(500).json({ error: 'Failed to get Wise entries' });
  }
});

// Manually trigger balance recalculation
router.post('/recalculate', async (req, res) => {
  try {
    const balances = await CurrencyModel.recalculateBalances();
    res.json({
      success: true,
      message: 'Currency balances recalculated successfully',
      balances
    });
  } catch (error) {
    console.error('Error recalculating balances:', error);
    res.status(500).json({ error: 'Failed to recalculate balances' });
  }
});

// Get total balance in USD (all currencies converted)
router.get('/total-usd', async (req, res) => {
  try {
    const totalData = await CurrencyModel.getTotalBalanceInUSD();
    res.json(totalData);
  } catch (error) {
    console.error('Error getting total USD balance:', error);
    res.status(500).json({ error: 'Failed to get total USD balance' });
  }
});

module.exports = router;
