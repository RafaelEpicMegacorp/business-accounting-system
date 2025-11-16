const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all project routes
router.use(authMiddleware);

// Project CRUD operations
router.get('/', projectController.getAll);
router.get('/stats', projectController.getStats);
router.get('/:id', projectController.getById);
router.get('/:id/employees', projectController.getWithEmployees);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);
router.post('/:id/archive', projectController.archive);

// Employee assignment operations
router.post('/:id/employees', projectController.assignEmployee);
router.delete('/:id/employees/:employeeId', projectController.removeEmployee);

module.exports = router;
