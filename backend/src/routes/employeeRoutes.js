const express = require('express');
const router = express.Router();
const EmployeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Bulk operations (must come before parameterized routes)
router.delete('/bulk', EmployeeController.bulkDelete);
router.post('/bulk/terminate', EmployeeController.bulkTerminate);
router.post('/bulk/reactivate', EmployeeController.bulkReactivate);

// Get all employees (with optional ?active=true/false filter)
router.get('/', EmployeeController.getAll);

// Get single employee by ID
router.get('/:id', EmployeeController.getById);

// Create new employee
router.post('/', EmployeeController.create);

// Update employee
router.put('/:id', EmployeeController.update);

// Calculate severance pay
router.post('/:id/calculate-severance', EmployeeController.calculateSeverance);

// Terminate employee
router.post('/:id/terminate', EmployeeController.terminate);

// Reactivate employee
router.post('/:id/reactivate', EmployeeController.reactivate);

// Delete employee (hard delete - only if no entries)
router.delete('/:id', EmployeeController.delete);

module.exports = router;
