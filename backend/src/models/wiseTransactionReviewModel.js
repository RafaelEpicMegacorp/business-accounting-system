const pool = require('../config/database');

const WiseTransactionReviewModel = {
  /**
   * Get transactions for review with advanced filtering and pagination
   * @param {Object} filters - Filter parameters
   * @param {Object} pagination - Pagination parameters
   * @returns {Promise<Object>} Transactions and pagination info
   */
  async getTransactionsForReview(filters = {}, pagination = {}) {
    const {
      status = 'pending',
      needs_review = true,
      min_confidence,
      max_confidence,
      currency,
      start_date,
      end_date,
      transaction_type
    } = filters;

    const {
      limit = 50,
      offset = 0
    } = pagination;

    // Build WHERE clause dynamically
    const whereClauses = [];
    const queryParams = [];
    let paramCounter = 1;

    // Status filter
    if (status && status !== 'all') {
      whereClauses.push(`wt.sync_status = $${paramCounter++}`);
      queryParams.push(status);
    }

    // Needs review filter
    if (needs_review !== null && needs_review !== undefined) {
      whereClauses.push(`wt.needs_review = $${paramCounter++}`);
      queryParams.push(needs_review);
    }

    // Confidence score filters
    if (min_confidence !== undefined) {
      whereClauses.push(`(wt.confidence_score >= $${paramCounter++} OR wt.confidence_score IS NULL)`);
      queryParams.push(min_confidence);
    }

    if (max_confidence !== undefined) {
      whereClauses.push(`(wt.confidence_score <= $${paramCounter++} OR wt.confidence_score IS NULL)`);
      queryParams.push(max_confidence);
    }

    // Currency filter
    if (currency && currency !== 'all') {
      whereClauses.push(`wt.currency = $${paramCounter++}`);
      queryParams.push(currency);
    }

    // Date range filters
    if (start_date) {
      whereClauses.push(`wt.transaction_date >= $${paramCounter++}`);
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClauses.push(`wt.transaction_date <= $${paramCounter++}`);
      queryParams.push(end_date);
    }

    // Transaction type filter
    if (transaction_type && transaction_type !== 'all') {
      whereClauses.push(`wt.type = $${paramCounter++}`);
      queryParams.push(transaction_type);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM wise_transactions wt
       ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results with joins
    const dataQuery = `
      SELECT
        wt.id,
        wt.wise_transaction_id,
        wt.merchant_name,
        wt.description,
        wt.amount,
        wt.currency,
        wt.transaction_date,
        wt.value_date,
        wt.type as transaction_type,
        wt.state,
        wt.classified_category,
        wt.confidence_score,
        wt.needs_review,
        wt.sync_status,
        wt.matched_employee_id,
        wt.processing_error,
        wt.created_at,
        wt.updated_at,
        e.name as employee_name,
        ent.id as entry_id,
        ent.status as entry_status
      FROM wise_transactions wt
      LEFT JOIN employees e ON wt.matched_employee_id = e.id
      LEFT JOIN entries ent ON ent.wise_transaction_id = wt.wise_transaction_id
      ${whereClause}
      ORDER BY
        wt.confidence_score ASC NULLS FIRST,
        wt.transaction_date DESC
      LIMIT $${paramCounter++}
      OFFSET $${paramCounter++}
    `;

    queryParams.push(limit, offset);

    const result = await pool.query(dataQuery, queryParams);

    return {
      transactions: result.rows,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    };
  },

  /**
   * Update transaction classification
   * @param {number} id - Transaction ID
   * @param {Object} updates - Classification updates
   * @returns {Promise<Object>} Updated transaction
   */
  async updateClassification(id, updates) {
    const {
      classified_category,
      matched_employee_id,
      needs_review
    } = updates;

    const setClauses = [];
    const values = [];
    let paramCounter = 1;

    if (classified_category !== undefined) {
      setClauses.push(`classified_category = $${paramCounter++}`);
      values.push(classified_category);
    }

    if (matched_employee_id !== undefined) {
      setClauses.push(`matched_employee_id = $${paramCounter++}`);
      values.push(matched_employee_id);
    }

    if (needs_review !== undefined) {
      setClauses.push(`needs_review = $${paramCounter++}`);
      values.push(needs_review);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE wise_transactions
       SET ${setClauses.join(', ')}
       WHERE id = $${paramCounter}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    return result.rows[0];
  },

  /**
   * Approve transaction and create entry
   * @param {number} id - Transaction ID
   * @param {Object} entryData - Entry creation data
   * @returns {Promise<Object>} Updated transaction and created entry
   */
  async approveTransaction(id, entryData) {
    const client = await pool.getClient();

    try {
      await client.query('BEGIN');

      // Get transaction details
      const transactionResult = await client.query(
        `SELECT * FROM wise_transactions WHERE id = $1`,
        [id]
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = transactionResult.rows[0];

      // Check if already processed
      if (transaction.entry_id) {
        throw new Error('Transaction already has an associated entry');
      }

      // Determine entry type based on transaction type
      const entryType = transaction.type === 'CREDIT' ? 'income' : 'expense';

      // Use provided category or classified category
      const category = entryData.category || transaction.classified_category || 'other_expenses';

      // Create entry
      const entryResult = await client.query(
        `INSERT INTO entries (
          type, category, amount, currency, base_amount,
          description, entry_date, status,
          employee_id, wise_transaction_id,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          entryType,
          category,
          Math.abs(parseFloat(transaction.amount)),
          transaction.currency,
          Math.abs(parseFloat(transaction.amount)), // base_amount = amount for now
          transaction.merchant_name || transaction.description || 'Wise Transaction',
          transaction.transaction_date,
          entryData.status || 'completed',
          entryData.employee_id || transaction.matched_employee_id || null,
          transaction.wise_transaction_id
        ]
      );

      const entry = entryResult.rows[0];

      // Update transaction status
      await client.query(
        `UPDATE wise_transactions
         SET sync_status = 'processed',
             entry_id = $1,
             needs_review = false,
             processed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [entry.id, id]
      );

      // Get updated transaction with joins
      const updatedTransactionResult = await client.query(
        `SELECT wt.*, e.name as employee_name, ent.id as entry_id
         FROM wise_transactions wt
         LEFT JOIN employees e ON wt.matched_employee_id = e.id
         LEFT JOIN entries ent ON ent.wise_transaction_id = wt.wise_transaction_id
         WHERE wt.id = $1`,
        [id]
      );

      await client.query('COMMIT');

      return {
        transaction: updatedTransactionResult.rows[0],
        entry: entry
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Reject transaction (mark as skipped)
   * @param {number} id - Transaction ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Updated transaction
   */
  async rejectTransaction(id, reason) {
    const result = await pool.query(
      `UPDATE wise_transactions
       SET sync_status = 'skipped',
           processing_error = $1,
           needs_review = false,
           processed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [reason || 'Rejected by user', id]
    );

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    return result.rows[0];
  },

  /**
   * Bulk approve transactions
   * @param {Array<number>} ids - Transaction IDs
   * @param {Object} defaultData - Default entry data for all
   * @returns {Promise<Object>} Bulk operation results
   */
  async bulkApprove(ids, defaultData = {}) {
    const client = await pool.getClient();

    try {
      await client.query('BEGIN');

      const results = {
        approved: 0,
        failed: 0,
        entries_created: 0,
        errors: []
      };

      for (const id of ids) {
        try {
          await this.approveTransactionWithClient(client, id, defaultData);
          results.approved++;
          results.entries_created++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            transaction_id: id,
            error: error.message
          });
        }
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Helper method to approve transaction with existing client (for bulk operations)
   * @param {Object} client - Database client
   * @param {number} id - Transaction ID
   * @param {Object} entryData - Entry creation data
   */
  async approveTransactionWithClient(client, id, entryData) {
    // Get transaction details
    const transactionResult = await client.query(
      `SELECT * FROM wise_transactions WHERE id = $1`,
      [id]
    );

    if (transactionResult.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    const transaction = transactionResult.rows[0];

    // Check if already processed
    if (transaction.entry_id) {
      throw new Error('Transaction already has an associated entry');
    }

    // Determine entry type based on transaction type
    const entryType = transaction.type === 'CREDIT' ? 'income' : 'expense';

    // Use provided category or classified category
    const category = entryData.category || transaction.classified_category || 'other_expenses';

    // Create entry
    const entryResult = await client.query(
      `INSERT INTO entries (
        type, category, amount, currency, base_amount,
        description, entry_date, status,
        employee_id, wise_transaction_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        entryType,
        category,
        Math.abs(parseFloat(transaction.amount)),
        transaction.currency,
        Math.abs(parseFloat(transaction.amount)),
        transaction.merchant_name || transaction.description || 'Wise Transaction',
        transaction.transaction_date,
        entryData.status || 'completed',
        entryData.employee_id || transaction.matched_employee_id || null,
        transaction.wise_transaction_id
      ]
    );

    // Update transaction status
    await client.query(
      `UPDATE wise_transactions
       SET sync_status = 'processed',
           entry_id = $1,
           needs_review = false,
           processed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [entryResult.rows[0].id, id]
    );
  },

  /**
   * Bulk reject transactions
   * @param {Array<number>} ids - Transaction IDs
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Bulk operation results
   */
  async bulkReject(ids, reason) {
    const result = await pool.query(
      `UPDATE wise_transactions
       SET sync_status = 'skipped',
           processing_error = $1,
           needs_review = false,
           processed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($2::int[])
       RETURNING id`,
      [reason || 'Bulk rejected by user', ids]
    );

    return {
      rejected: result.rows.length,
      failed: ids.length - result.rows.length
    };
  },

  /**
   * Get transaction review statistics
   * @returns {Promise<Object>} Review statistics
   */
  async getReviewStats() {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE sync_status = 'pending' AND needs_review = true) as pending_review,
        COUNT(*) FILTER (WHERE confidence_score < 60 AND sync_status = 'pending') as low_confidence,
        COUNT(*) FILTER (WHERE sync_status = 'processed' AND DATE(processed_at) = CURRENT_DATE) as approved_today,
        AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL) as avg_confidence_score
      FROM wise_transactions
    `);

    return result.rows[0];
  }
};

module.exports = WiseTransactionReviewModel;
