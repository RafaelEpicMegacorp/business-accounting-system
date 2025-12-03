const ClassificationModel = require('../models/classificationModel');
const SuggestionModel = require('../models/suggestionModel');

const classificationController = {
  /**
   * Get all classifications (flat or hierarchical)
   */
  async getAll(req, res) {
    try {
      const { format } = req.query;

      if (format === 'hierarchy') {
        const classifications = await ClassificationModel.getHierarchy();
        return res.json({ success: true, data: classifications });
      }

      const classifications = await ClassificationModel.getAll();
      res.json({ success: true, data: classifications });
    } catch (error) {
      console.error('Error getting classifications:', error);
      res.status(500).json({ success: false, error: 'Failed to get classifications' });
    }
  },

  /**
   * Get classification by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const classification = await ClassificationModel.getById(id);

      if (!classification) {
        return res.status(404).json({ success: false, error: 'Classification not found' });
      }

      res.json({ success: true, data: classification });
    } catch (error) {
      console.error('Error getting classification:', error);
      res.status(500).json({ success: false, error: 'Failed to get classification' });
    }
  },

  /**
   * Create a new classification
   */
  async create(req, res) {
    try {
      const { name, parent_id, description, sort_order } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }

      // Check if parent exists
      if (parent_id) {
        const parent = await ClassificationModel.getById(parent_id);
        if (!parent) {
          return res.status(400).json({ success: false, error: 'Parent classification not found' });
        }
      }

      const classification = await ClassificationModel.create({
        name,
        parent_id,
        description,
        sort_order
      });

      res.status(201).json({ success: true, data: classification });
    } catch (error) {
      console.error('Error creating classification:', error);
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'Classification already exists' });
      }
      res.status(500).json({ success: false, error: 'Failed to create classification' });
    }
  },

  /**
   * Update a classification
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, parent_id, description, sort_order } = req.body;

      const existing = await ClassificationModel.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Classification not found' });
      }

      if (existing.is_default && parent_id !== undefined && parent_id !== existing.parent_id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot change parent of default classification'
        });
      }

      const classification = await ClassificationModel.update(id, {
        name,
        parent_id,
        description,
        sort_order
      });

      res.json({ success: true, data: classification });
    } catch (error) {
      console.error('Error updating classification:', error);
      res.status(500).json({ success: false, error: 'Failed to update classification' });
    }
  },

  /**
   * Delete a classification
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      const classification = await ClassificationModel.delete(id);
      if (!classification) {
        return res.status(404).json({ success: false, error: 'Classification not found or is default' });
      }

      res.json({ success: true, data: classification, message: 'Classification deleted' });
    } catch (error) {
      console.error('Error deleting classification:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * Search classifications
   */
  async search(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
      }

      const results = await ClassificationModel.search(q);
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Error searching classifications:', error);
      res.status(500).json({ success: false, error: 'Failed to search classifications' });
    }
  },

  // ============================================
  // Suggestion Endpoints
  // ============================================

  /**
   * Get pending suggestions
   */
  async getPendingSuggestions(req, res) {
    try {
      const suggestions = await SuggestionModel.getPending();
      res.json({ success: true, data: suggestions });
    } catch (error) {
      console.error('Error getting pending suggestions:', error);
      res.status(500).json({ success: false, error: 'Failed to get suggestions' });
    }
  },

  /**
   * Get suggestion history
   */
  async getSuggestionHistory(req, res) {
    try {
      const { status, from_date, to_date, limit, offset } = req.query;

      const history = await SuggestionModel.getHistory({
        status,
        from_date,
        to_date,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      });

      res.json({ success: true, data: history });
    } catch (error) {
      console.error('Error getting suggestion history:', error);
      res.status(500).json({ success: false, error: 'Failed to get suggestion history' });
    }
  },

  /**
   * Get suggestion statistics
   */
  async getSuggestionStats(req, res) {
    try {
      const stats = await SuggestionModel.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error getting suggestion stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get suggestion stats' });
    }
  },

  /**
   * Accept a suggestion
   */
  async acceptSuggestion(req, res) {
    try {
      const { id } = req.params;
      const { classification_id, amount, frequency, notes } = req.body;
      const userId = req.user?.id || null;

      const result = await SuggestionModel.accept(id, userId, {
        classification_id,
        amount,
        frequency,
        notes
      });

      res.json({
        success: true,
        data: result,
        message: 'Suggestion accepted and pattern created'
      });
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * Reject a suggestion - Enhanced with structured rejection reason
   */
  async rejectSuggestion(req, res) {
    try {
      const { id } = req.params;
      const { reason, notes } = req.body;
      const userId = req.user?.id || null;

      // Pass both reason and notes as rejection data
      const result = await SuggestionModel.reject(id, userId, { reason, notes });

      res.json({ success: true, data: result, message: 'Suggestion rejected' });
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * Modify and accept a suggestion
   */
  async modifySuggestion(req, res) {
    try {
      const { id } = req.params;
      const { classification_id, amount, frequency, notes } = req.body;
      const userId = req.user?.id || null;

      const result = await SuggestionModel.modify(id, userId, {
        classification_id,
        amount,
        frequency,
        notes
      });

      res.json({
        success: true,
        data: result,
        message: 'Suggestion modified and pattern created'
      });
    } catch (error) {
      console.error('Error modifying suggestion:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * Bulk accept suggestions
   */
  async bulkAcceptSuggestions(req, res) {
    try {
      const { ids } = req.body;
      const userId = req.user?.id || null;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'IDs array is required' });
      }

      const results = await SuggestionModel.bulkAccept(ids, userId);

      res.json({
        success: true,
        data: results,
        message: `${results.length} suggestions accepted`
      });
    } catch (error) {
      console.error('Error bulk accepting suggestions:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * Bulk reject suggestions
   */
  async bulkRejectSuggestions(req, res) {
    try {
      const { ids, reason } = req.body;
      const userId = req.user?.id || null;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'IDs array is required' });
      }

      const results = await SuggestionModel.bulkReject(ids, userId, reason);

      res.json({
        success: true,
        data: results,
        message: `${results.length} suggestions rejected`
      });
    } catch (error) {
      console.error('Error bulk rejecting suggestions:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // ============================================
  // Decision History & Learning Endpoints
  // ============================================

  /**
   * Get decision history with pagination and filtering
   */
  async getDecisionHistory(req, res) {
    try {
      const { decision, from_date, to_date, limit, offset } = req.query;

      const history = await SuggestionModel.getDecisionHistory({
        decision,
        from_date,
        to_date,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      });

      res.json({ success: true, data: history });
    } catch (error) {
      console.error('Error getting decision history:', error);
      res.status(500).json({ success: false, error: 'Failed to get decision history' });
    }
  },

  /**
   * Get decision statistics for learning insights
   */
  async getDecisionStats(req, res) {
    try {
      const stats = await SuggestionModel.getDecisionStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error getting decision stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get decision stats' });
    }
  },

  /**
   * Get learning context (what the AI learns from user decisions)
   */
  async getLearningContext(req, res) {
    try {
      const context = await SuggestionModel.getLearningContext();
      res.json({ success: true, data: context });
    } catch (error) {
      console.error('Error getting learning context:', error);
      res.status(500).json({ success: false, error: 'Failed to get learning context' });
    }
  },

  /**
   * Clear rejected decision history
   */
  async clearRejectedHistory(req, res) {
    try {
      const { description } = req.body;

      const result = await SuggestionModel.clearRejectedHistory(description);

      res.json({
        success: true,
        data: result,
        message: description
          ? `Cleared rejection history for "${description}"`
          : `Cleared all rejection history (${result.cleared} records)`
      });
    } catch (error) {
      console.error('Error clearing rejected history:', error);
      res.status(500).json({ success: false, error: 'Failed to clear rejected history' });
    }
  }
};

module.exports = classificationController;
