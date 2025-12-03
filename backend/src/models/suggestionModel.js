const pool = require('../config/database');
const crypto = require('crypto');

const SuggestionModel = {
  /**
   * Get pending suggestions
   */
  async getPending() {
    const result = await pool.query(`
      SELECT
        s.*,
        sc.name as suggested_classification_name,
        sp.name as suggested_classification_parent,
        uc.name as user_classification_name,
        up.name as user_classification_parent
      FROM ai_expense_suggestions s
      LEFT JOIN expense_classifications sc ON s.suggested_classification_id = sc.id
      LEFT JOIN expense_classifications sp ON sc.parent_id = sp.id
      LEFT JOIN expense_classifications uc ON s.user_classification_id = uc.id
      LEFT JOIN expense_classifications up ON uc.parent_id = up.id
      WHERE s.status = 'pending'
      ORDER BY s.confidence_score DESC, s.typical_amount DESC
    `);
    return result.rows;
  },

  /**
   * Get suggestions by status
   */
  async getByStatus(status) {
    const result = await pool.query(`
      SELECT
        s.*,
        sc.name as suggested_classification_name,
        sp.name as suggested_classification_parent
      FROM ai_expense_suggestions s
      LEFT JOIN expense_classifications sc ON s.suggested_classification_id = sc.id
      LEFT JOIN expense_classifications sp ON sc.parent_id = sp.id
      WHERE s.status = $1
      ORDER BY s.resolved_at DESC NULLS FIRST, s.created_at DESC
    `, [status]);
    return result.rows;
  },

  /**
   * Get suggestion by ID
   */
  async getById(id) {
    const result = await pool.query(`
      SELECT
        s.*,
        sc.name as suggested_classification_name,
        sp.name as suggested_classification_parent
      FROM ai_expense_suggestions s
      LEFT JOIN expense_classifications sc ON s.suggested_classification_id = sc.id
      LEFT JOIN expense_classifications sp ON sc.parent_id = sp.id
      WHERE s.id = $1
    `, [id]);
    return result.rows[0];
  },

  /**
   * Create a new suggestion (from AI analysis)
   */
  async create(data) {
    const {
      description,
      suggested_classification_id,
      typical_amount,
      amount_variance,
      currency,
      frequency,
      confidence_score,
      trend,
      trend_rate,
      reasoning,
      source_entry_ids,
      occurrence_count,
      last_occurrence,
      next_expected_date,
      next_expected_amount,
      analysis_batch_id
    } = data;

    const result = await pool.query(`
      INSERT INTO ai_expense_suggestions (
        description, suggested_classification_id, typical_amount, amount_variance,
        currency, frequency, confidence_score, trend, trend_rate, reasoning,
        source_entry_ids, occurrence_count, last_occurrence, next_expected_date,
        next_expected_amount, analysis_batch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      description, suggested_classification_id, typical_amount, amount_variance,
      currency || 'USD', frequency, confidence_score, trend, trend_rate, reasoning,
      source_entry_ids, occurrence_count, last_occurrence, next_expected_date,
      next_expected_amount, analysis_batch_id
    ]);
    return result.rows[0];
  },

  /**
   * Create multiple suggestions in batch
   */
  async createBatch(suggestions, batchId = null) {
    const batch = batchId || crypto.randomUUID();
    const created = [];

    for (const suggestion of suggestions) {
      const result = await this.create({
        ...suggestion,
        analysis_batch_id: batch
      });
      created.push(result);
    }

    return { batch_id: batch, suggestions: created };
  },

  /**
   * Accept a suggestion (creates recurring pattern) - Enhanced with learning context
   */
  async accept(id, userId, modifications = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the suggestion
      const suggestion = await this.getById(id);
      if (!suggestion) {
        throw new Error('Suggestion not found');
      }

      const finalClassificationId = modifications?.classification_id || suggestion.suggested_classification_id;
      const finalAmount = modifications?.amount || suggestion.typical_amount;
      const finalFrequency = modifications?.frequency || suggestion.frequency;

      // Get classification names for learning context
      let suggestedClassName = suggestion.suggested_classification_name;
      let finalClassName = null;

      if (finalClassificationId) {
        const finalClassResult = await client.query(
          'SELECT name FROM expense_classifications WHERE id = $1',
          [finalClassificationId]
        );
        finalClassName = finalClassResult.rows[0]?.name;
      }

      // Update suggestion status
      await client.query(`
        UPDATE ai_expense_suggestions
        SET status = 'accepted',
            user_classification_id = $1,
            resolved_at = NOW(),
            resolved_by = $2,
            user_notes = $3
        WHERE id = $4
      `, [finalClassificationId, userId, modifications?.notes || null, id]);

      // Create recurring expense pattern
      const patternResult = await client.query(`
        INSERT INTO recurring_expense_patterns (
          description, category, typical_amount, frequency, confidence_score,
          classification_id, trend, trend_rate, next_expected_date,
          next_expected_amount, occurrence_count, source, llm_reasoning
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ai', $12)
        RETURNING *
      `, [
        suggestion.description,
        'expense', // category
        finalAmount,
        finalFrequency,
        suggestion.confidence_score,
        finalClassificationId,
        suggestion.trend,
        suggestion.trend_rate,
        suggestion.next_expected_date,
        suggestion.next_expected_amount,
        suggestion.occurrence_count,
        suggestion.reasoning
      ]);

      // Record feedback for learning - ENHANCED with full context
      await client.query(`
        INSERT INTO ai_decision_feedback (
          suggestion_id, decision, original_classification_id,
          final_classification_id, original_amount, modified_amount,
          confidence_at_decision, user_id,
          description, suggested_classification_name, final_classification_name,
          suggested_frequency, currency, user_notes
        ) VALUES ($1, 'accepted', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        id,
        suggestion.suggested_classification_id,
        finalClassificationId,
        suggestion.typical_amount,
        finalAmount,
        suggestion.confidence_score,
        userId,
        suggestion.description,
        suggestedClassName,
        finalClassName,
        suggestion.frequency,
        suggestion.currency || 'USD',
        modifications?.notes || null
      ]);

      await client.query('COMMIT');

      return {
        suggestion: await this.getById(id),
        pattern: patternResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Reject a suggestion - Enhanced with learning context
   */
  async reject(id, userId, rejectionData = {}) {
    const suggestion = await this.getById(id);
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Extract rejection data
    const reason = typeof rejectionData === 'string' ? rejectionData : rejectionData.reason || null;
    const notes = typeof rejectionData === 'string' ? null : rejectionData.notes || null;

    // Update status
    await pool.query(`
      UPDATE ai_expense_suggestions
      SET status = 'rejected',
          resolved_at = NOW(),
          resolved_by = $1,
          user_notes = $2
      WHERE id = $3
    `, [userId, notes, id]);

    // Record feedback with full learning context
    await pool.query(`
      INSERT INTO ai_decision_feedback (
        suggestion_id, decision, original_classification_id,
        original_amount, confidence_at_decision, user_id,
        description, suggested_classification_name, suggested_frequency,
        currency, rejection_reason, user_notes
      ) VALUES ($1, 'rejected', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      id,
      suggestion.suggested_classification_id,
      suggestion.typical_amount,
      suggestion.confidence_score,
      userId,
      suggestion.description,
      suggestion.suggested_classification_name,
      suggestion.frequency,
      suggestion.currency || 'USD',
      reason,
      notes
    ]);

    return this.getById(id);
  },

  /**
   * Modify and accept a suggestion
   */
  async modify(id, userId, modifications) {
    return this.accept(id, userId, modifications);
  },

  /**
   * Get suggestion history with filters
   */
  async getHistory(filters = {}) {
    const { status, from_date, to_date, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        s.*,
        sc.name as suggested_classification_name,
        uc.name as user_classification_name,
        u.name as resolved_by_name
      FROM ai_expense_suggestions s
      LEFT JOIN expense_classifications sc ON s.suggested_classification_id = sc.id
      LEFT JOIN expense_classifications uc ON s.user_classification_id = uc.id
      LEFT JOIN users u ON s.resolved_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }

    if (from_date) {
      query += ` AND s.created_at >= $${paramIndex++}`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND s.created_at <= $${paramIndex++}`;
      params.push(to_date);
    }

    query += ` ORDER BY s.resolved_at DESC NULLS FIRST, s.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Get statistics about suggestions
   */
  async getStats() {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE status = 'modified') as modified_count,
        AVG(confidence_score) FILTER (WHERE status = 'accepted') as avg_accepted_confidence,
        AVG(confidence_score) FILTER (WHERE status = 'rejected') as avg_rejected_confidence
      FROM ai_expense_suggestions
    `);
    return result.rows[0];
  },

  /**
   * Clear old pending suggestions (before new analysis)
   */
  async clearPending(batchId = null) {
    if (batchId) {
      await pool.query(
        'DELETE FROM ai_expense_suggestions WHERE status = $1 AND analysis_batch_id = $2',
        ['pending', batchId]
      );
    } else {
      await pool.query(
        'DELETE FROM ai_expense_suggestions WHERE status = $1',
        ['pending']
      );
    }
  },

  /**
   * Check if similar suggestion already exists
   */
  async findSimilar(description, amount, tolerance = 0.1) {
    const result = await pool.query(`
      SELECT * FROM ai_expense_suggestions
      WHERE LOWER(description) = LOWER($1)
        AND status = 'pending'
        AND ABS(typical_amount - $2) / GREATEST(typical_amount, $2) < $3
    `, [description, amount, tolerance]);
    return result.rows[0];
  },

  /**
   * Bulk accept suggestions
   */
  async bulkAccept(ids, userId) {
    const results = [];
    for (const id of ids) {
      const result = await this.accept(id, userId);
      results.push(result);
    }
    return results;
  },

  /**
   * Bulk reject suggestions
   */
  async bulkReject(ids, userId, reason = null) {
    const results = [];
    for (const id of ids) {
      const result = await this.reject(id, userId, reason);
      results.push(result);
    }
    return results;
  },

  // ============================================
  // LEARNING METHODS
  // ============================================

  /**
   * Get decision history with pagination and filtering
   */
  async getDecisionHistory(filters = {}) {
    const { decision, from_date, to_date, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        f.*,
        s.typical_amount as suggested_amount,
        s.trend,
        s.reasoning
      FROM ai_decision_feedback f
      LEFT JOIN ai_expense_suggestions s ON f.suggestion_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (decision) {
      query += ` AND f.decision = $${paramIndex++}`;
      params.push(decision);
    }

    if (from_date) {
      query += ` AND f.created_at >= $${paramIndex++}`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND f.created_at <= $${paramIndex++}`;
      params.push(to_date);
    }

    query += ` ORDER BY f.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM ai_decision_feedback f WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;

    if (decision) {
      countQuery += ` AND f.decision = $${countParamIndex++}`;
      countParams.push(decision);
    }
    if (from_date) {
      countQuery += ` AND f.created_at >= $${countParamIndex++}`;
      countParams.push(from_date);
    }
    if (to_date) {
      countQuery += ` AND f.created_at <= $${countParamIndex++}`;
      countParams.push(to_date);
    }

    const countResult = await pool.query(countQuery, countParams);

    return {
      decisions: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  },

  /**
   * Get decision statistics for learning insights
   */
  async getDecisionStats() {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_decisions,
        COUNT(*) FILTER (WHERE decision = 'accepted') as accepted_count,
        COUNT(*) FILTER (WHERE decision = 'rejected') as rejected_count,
        ROUND(
          (COUNT(*) FILTER (WHERE decision = 'accepted')::numeric / NULLIF(COUNT(*), 0)) * 100,
          1
        ) as acceptance_rate,
        AVG(confidence_at_decision) FILTER (WHERE decision = 'accepted') as avg_accepted_confidence,
        AVG(confidence_at_decision) FILTER (WHERE decision = 'rejected') as avg_rejected_confidence,
        COUNT(*) FILTER (WHERE final_classification_id != original_classification_id AND final_classification_id IS NOT NULL) as classification_corrections
      FROM ai_decision_feedback
    `);

    // Get common rejection reasons
    const rejectionReasons = await pool.query(`
      SELECT
        rejection_reason,
        COUNT(*) as count
      FROM ai_decision_feedback
      WHERE decision = 'rejected' AND rejection_reason IS NOT NULL
      GROUP BY rejection_reason
      ORDER BY count DESC
      LIMIT 5
    `);

    // Get most corrected classifications
    const corrections = await pool.query(`
      SELECT
        suggested_classification_name,
        final_classification_name,
        COUNT(*) as count
      FROM ai_decision_feedback
      WHERE decision = 'accepted'
        AND final_classification_id != original_classification_id
        AND final_classification_id IS NOT NULL
        AND suggested_classification_name IS NOT NULL
        AND final_classification_name IS NOT NULL
      GROUP BY suggested_classification_name, final_classification_name
      ORDER BY count DESC
      LIMIT 10
    `);

    return {
      ...result.rows[0],
      common_rejection_reasons: rejectionReasons.rows,
      classification_corrections: corrections.rows
    };
  },

  /**
   * Get learning context for AI prompts
   * Returns formatted data about user preferences and corrections
   */
  async getLearningContext() {
    // Get rejected patterns (to avoid suggesting again)
    const rejected = await pool.query(`
      SELECT
        description,
        rejection_reason,
        COUNT(*) as rejection_count
      FROM ai_decision_feedback
      WHERE decision = 'rejected'
        AND description IS NOT NULL
      GROUP BY description, rejection_reason
      ORDER BY rejection_count DESC
      LIMIT 30
    `);

    // Get classification corrections (to learn preferred categories)
    const corrections = await pool.query(`
      SELECT
        description,
        suggested_classification_name,
        final_classification_name,
        COUNT(*) as correction_count
      FROM ai_decision_feedback
      WHERE decision = 'accepted'
        AND final_classification_id != original_classification_id
        AND final_classification_id IS NOT NULL
        AND suggested_classification_name IS NOT NULL
        AND final_classification_name IS NOT NULL
      GROUP BY description, suggested_classification_name, final_classification_name
      ORDER BY correction_count DESC
      LIMIT 20
    `);

    // Get amount adjustments (to learn better amounts)
    const amountAdjustments = await pool.query(`
      SELECT
        description,
        AVG(original_amount) as avg_suggested_amount,
        AVG(modified_amount) as avg_final_amount,
        COUNT(*) as adjustment_count
      FROM ai_decision_feedback
      WHERE decision = 'accepted'
        AND modified_amount IS NOT NULL
        AND modified_amount != original_amount
        AND description IS NOT NULL
      GROUP BY description
      HAVING COUNT(*) >= 1
      ORDER BY adjustment_count DESC
      LIMIT 15
    `);

    // Get overall stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE decision = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE decision = 'rejected') as rejected,
        AVG(confidence_at_decision) FILTER (WHERE decision = 'accepted') as avg_accepted_confidence
      FROM ai_decision_feedback
    `);

    return {
      rejected_patterns: rejected.rows,
      classification_corrections: corrections.rows,
      amount_adjustments: amountAdjustments.rows,
      stats: stats.rows[0]
    };
  },

  /**
   * Clear rejected decision history (to reset learning for specific items)
   */
  async clearRejectedHistory(description = null) {
    if (description) {
      // Clear specific description
      const result = await pool.query(
        'DELETE FROM ai_decision_feedback WHERE decision = $1 AND description = $2 RETURNING id',
        ['rejected', description]
      );
      return { cleared: result.rowCount };
    } else {
      // Clear all rejected
      const result = await pool.query(
        'DELETE FROM ai_decision_feedback WHERE decision = $1 RETURNING id',
        ['rejected']
      );
      return { cleared: result.rowCount };
    }
  }
};

module.exports = SuggestionModel;
