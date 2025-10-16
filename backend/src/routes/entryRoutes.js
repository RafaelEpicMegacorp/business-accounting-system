const express = require('express');
const router = express.Router();
const EntryController = require('../controllers/entryController');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Order matters: specific routes before parameterized routes
router.get('/totals', EntryController.getTotals);
router.get('/scheduled', EntryController.getScheduled);
router.get('/forecast', EntryController.getForecast);
router.get('/income', EntryController.getIncome);
router.get('/expenses', EntryController.getExpenses);
router.get('/salaries', EntryController.getSalaries);
router.delete('/bulk', EntryController.bulkDelete);
router.put('/bulk/status', EntryController.bulkUpdateStatus);
router.get('/', EntryController.getAll);
router.get('/:id', EntryController.getById);
router.post('/', EntryController.create);
router.put('/:id', EntryController.update);
router.delete('/:id', EntryController.delete);

module.exports = router;
