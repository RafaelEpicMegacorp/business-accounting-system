const express = require('express');
const router = express.Router();
const PositionController = require('../controllers/positionController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/positions - Get all positions
router.get('/', PositionController.getAll);

// GET /api/positions/counts - Get employee counts by position
router.get('/counts', PositionController.getCounts);

// GET /api/positions/:id - Get single position
router.get('/:id', PositionController.getById);

// POST /api/positions - Create new position
router.post('/', PositionController.create);

// PUT /api/positions/:id - Update position
router.put('/:id', PositionController.update);

// DELETE /api/positions/:id - Soft delete position
router.delete('/:id', PositionController.delete);

module.exports = router;
