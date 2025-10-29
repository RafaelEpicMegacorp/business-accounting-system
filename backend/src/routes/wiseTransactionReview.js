const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const WiseTransactionReviewModel = require('../models/wiseTransactionReviewModel');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/wise/transactions/review
 * Get transactions for review with filtering and pagination
 */
router.get('/transactions/review', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      needs_review: req.query.needs_review === 'true' ? true : req.query.needs_review === 'false' ? false : undefined,
      min_confidence: req.query.min_confidence ? parseFloat(req.query.min_confidence) : undefined,
      max_confidence: req.query.max_confidence ? parseFloat(req.query.max_confidence) : undefined,
      currency: req.query.currency,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      transaction_type: req.query.transaction_type
    };

    const pagination = {
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const result = await WiseTransactionReviewModel.getTransactionsForReview(filters, pagination);

    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching transactions for review:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to fetch transactions for review'
    });
  }
});

/**
 * GET /api/wise/transactions/review/stats
 * Get transaction review statistics
 */
router.get('/transactions/review/stats', async (req, res) => {
  try {
    const stats = await WiseTransactionReviewModel.getReviewStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to fetch review statistics'
    });
  }
});

/**
 * PATCH /api/wise/transactions/:id
 * Update transaction classification
 */
router.patch('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {
      classified_category: req.body.classified_category,
      matched_employee_id: req.body.matched_employee_id,
      needs_review: req.body.needs_review
    };

    const transaction = await WiseTransactionReviewModel.updateClassification(parseInt(id), updates);

    res.json({
      success: true,
      data: transaction,
      message: 'Transaction classification updated'
    });
  } catch (error) {
    console.error('Error updating transaction classification:', error);

    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Transaction not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to update transaction classification'
    });
  }
});

/**
 * POST /api/wise/transactions/:id/approve
 * Approve transaction and create entry
 */
router.post('/transactions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const entryData = {
      category: req.body.category,
      employee_id: req.body.employee_id,
      status: req.body.status || 'completed'
    };

    const result = await WiseTransactionReviewModel.approveTransaction(parseInt(id), entryData);

    res.json({
      success: true,
      data: result,
      message: 'Transaction approved and entry created'
    });
  } catch (error) {
    console.error('Error approving transaction:', error);

    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Transaction not found'
      });
    }

    if (error.message === 'Transaction already has an associated entry') {
      return res.status(400).json({
        success: false,
        error: 'already_processed',
        message: 'Transaction has already been approved'
      });
    }

    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to approve transaction'
    });
  }
});

/**
 * POST /api/wise/transactions/:id/reject
 * Reject transaction (mark as skipped)
 */
router.post('/transactions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const transaction = await WiseTransactionReviewModel.rejectTransaction(parseInt(id), reason);

    res.json({
      success: true,
      data: transaction,
      message: 'Transaction rejected'
    });
  } catch (error) {
    console.error('Error rejecting transaction:', error);

    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Transaction not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to reject transaction'
    });
  }
});

/**
 * POST /api/wise/transactions/bulk-approve
 * Bulk approve transactions
 */
router.post('/transactions/bulk-approve', async (req, res) => {
  try {
    const { transaction_ids, default_category, status } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_input',
        message: 'transaction_ids must be a non-empty array'
      });
    }

    const defaultData = {
      category: default_category,
      status: status || 'completed'
    };

    const results = await WiseTransactionReviewModel.bulkApprove(transaction_ids, defaultData);

    res.json({
      success: true,
      data: results,
      message: `Bulk approval completed: ${results.approved} approved, ${results.failed} failed`
    });
  } catch (error) {
    console.error('Error in bulk approve:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to bulk approve transactions'
    });
  }
});

/**
 * POST /api/wise/transactions/bulk-reject
 * Bulk reject transactions
 */
router.post('/transactions/bulk-reject', async (req, res) => {
  try {
    const { transaction_ids, reason } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_input',
        message: 'transaction_ids must be a non-empty array'
      });
    }

    const results = await WiseTransactionReviewModel.bulkReject(transaction_ids, reason);

    res.json({
      success: true,
      data: results,
      message: `Bulk rejection completed: ${results.rejected} rejected, ${results.failed} failed`
    });
  } catch (error) {
    console.error('Error in bulk reject:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to bulk reject transactions'
    });
  }
});

module.exports = router;
