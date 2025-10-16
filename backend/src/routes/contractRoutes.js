const express = require('express');
const router = express.Router();
const ContractController = require('../controllers/contractController');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Order matters: specific routes before parameterized routes
router.get('/active', ContractController.getActive);
router.get('/stats/revenue', ContractController.getRevenue);
router.post('/:id/generate-entries', ContractController.generateEntries);
router.get('/:id', ContractController.getById);
router.get('/', ContractController.getAll);
router.post('/', ContractController.create);
router.put('/:id', ContractController.update);
router.delete('/:id', ContractController.delete);

module.exports = router;
