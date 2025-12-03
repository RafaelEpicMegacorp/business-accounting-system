const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

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
    const batch = batchId || uuidv4();
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
   * Accept a suggestion (creates recurring pattern)
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

      // Record feedback for learning
      await client.query(`
        INSERT INTO ai_decision_feedback (
          suggestion_id, decision, original_classification_id,
          final_classification_id, original_amount, modified_amount,
          confidence_at_decision, user_id
        ) VALUES ($1, 'accepted', $2, $3, $4, $5, $6, $7)
      `, [
        id,
        suggestion.suggested_classification_id,
        finalClassificationId,
        suggestion.typical_amount,
        finalAmount,
        suggestion.confidence_score,
        userId
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
   * Reject a suggestion
   */
  async reject(id, userId, reason = null) {
    const suggestion = await this.getById(id);
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Update status
    await pool.query(`
      UPDATE ai_expense_suggestions
      SET status = 'rejected',
          resolved_at = NOW(),
          resolved_by = $1,
          user_notes = $2
      WHERE id = $3
    `, [userId, reason, id]);

    // Record feedback
    await pool.query(`
      INSERT INTO ai_decision_feedback (
        suggestion_id, decision, original_classification_id,
        original_amount, confidence_at_decision, user_id
      ) VALUES ($1, 'rejected', $2, $3, $4, $5)
    `, [
      id,
      suggestion.suggested_classification_id,
      suggestion.typical_amount,
      suggestion.confidence_score,
      userId
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
  }
};

module.exports = SuggestionModel;
