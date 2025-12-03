const express = require('express');
const router = express.Router();
const classificationController = require('../controllers/classificationController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// ============================================
// Classification Routes
// ============================================

// GET /api/classifications - Get all classifications
router.get('/', classificationController.getAll);

// GET /api/classifications/search - Search classifications
router.get('/search', classificationController.search);

// POST /api/classifications - Create classification
router.post('/', classificationController.create);

// ============================================
// Suggestion Routes (also under /api/classifications)
// ============================================

// GET /api/classifications/suggestions/pending - Get pending suggestions
router.get('/suggestions/pending', classificationController.getPendingSuggestions);

// GET /api/classifications/suggestions/history - Get suggestion history
router.get('/suggestions/history', classificationController.getSuggestionHistory);

// GET /api/classifications/suggestions/stats - Get suggestion statistics
router.get('/suggestions/stats', classificationController.getSuggestionStats);

// POST /api/classifications/suggestions/:id/accept - Accept suggestion
router.post('/suggestions/:id/accept', classificationController.acceptSuggestion);

// POST /api/classifications/suggestions/:id/reject - Reject suggestion
router.post('/suggestions/:id/reject', classificationController.rejectSuggestion);

// PUT /api/classifications/suggestions/:id - Modify and accept suggestion
router.put('/suggestions/:id', classificationController.modifySuggestion);

// POST /api/classifications/suggestions/bulk-accept - Bulk accept
router.post('/suggestions/bulk-accept', classificationController.bulkAcceptSuggestions);

// POST /api/classifications/suggestions/bulk-reject - Bulk reject
router.post('/suggestions/bulk-reject', classificationController.bulkRejectSuggestions);

// ============================================
// Decision History & Learning Routes
// ============================================

// GET /api/classifications/decisions/history - Get decision history with pagination
router.get('/decisions/history', classificationController.getDecisionHistory);

// GET /api/classifications/decisions/stats - Get decision statistics
router.get('/decisions/stats', classificationController.getDecisionStats);

// GET /api/classifications/decisions/learning-context - Get what AI learns from decisions
router.get('/decisions/learning-context', classificationController.getLearningContext);

// DELETE /api/classifications/decisions/rejected - Clear rejected history
router.delete('/decisions/rejected', classificationController.clearRejectedHistory);

// ============================================
// Parametric Routes (MUST be last to avoid conflicts)
// ============================================

// GET /api/classifications/:id - Get classification by ID
router.get('/:id', classificationController.getById);

// PUT /api/classifications/:id - Update classification
router.put('/:id', classificationController.update);

// DELETE /api/classifications/:id - Delete classification
router.delete('/:id', classificationController.delete);

module.exports = router;
