const pool = require('../config/database');

const WiseTransactionModel = {
  /**
   * Create a new Wise transaction record
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} Created transaction record
   */
  async create(transaction) {
    const {
      wiseTransactionId,
      wiseResourceId,
      profileId,
      accountId,
      type,
      state,
      amount,
      currency,
      description,
      merchantName,
      referenceNumber,
      transactionDate,
      valueDate,
      syncStatus = 'pending',
      classifiedCategory,
      matchedEmployeeId,
      confidenceScore,
      needsReview = false,
      rawPayload,
      // NEW FIELDS:
      transferFee,
      transferExchangeRate,
      recipientDetails
    } = transaction;

    const result = await pool.query(
      `INSERT INTO wise_transactions (
        wise_transaction_id, wise_resource_id, profile_id, account_id,
        type, state, amount, currency,
        description, merchant_name, reference_number,
        transaction_date, value_date,
        sync_status, classified_category, matched_employee_id,
        confidence_score, needs_review, raw_payload,
        transfer_fee, transfer_exchange_rate, recipient_details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        wiseTransactionId, wiseResourceId, profileId, accountId,
        type, state, amount, currency,
        description, merchantName, referenceNumber,
        transactionDate, valueDate,
        syncStatus, classifiedCategory, matchedEmployeeId,
        confidenceScore, needsReview, rawPayload ? JSON.stringify(rawPayload) : null,
        transferFee || null,
        transferExchangeRate || null,
        recipientDetails ? JSON.stringify(recipientDetails) : null
      ]
    );

    return result.rows[0];
  },

  /**
   * Get transaction by Wise transaction ID
   * @param {string} wiseTransactionId - Wise transaction ID
   * @returns {Promise<Object|null>} Transaction record or null
   */
  async getByWiseId(wiseTransactionId) {
    const result = await pool.query(
      'SELECT * FROM wise_transactions WHERE wise_transaction_id = $1',
      [wiseTransactionId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get transaction by internal ID
   * @param {number} id - Internal transaction ID
   * @returns {Promise<Object|null>} Transaction record or null
   */
  async getById(id) {
    const result = await pool.query(
      `SELECT wt.*, e.name as employee_name, ent.id as entry_id
       FROM wise_transactions wt
       LEFT JOIN employees e ON wt.matched_employee_id = e.id
       LEFT JOIN entries ent ON ent.wise_transaction_id = wt.wise_transaction_id
       WHERE wt.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all transactions needing review
   * @returns {Promise<Array>} List of transactions needing review
   */
  async getPendingReview() {
    const result = await pool.query(
      `SELECT wt.*, e.name as employee_name
       FROM wise_transactions wt
       LEFT JOIN employees e ON wt.matched_employee_id = e.id
       WHERE wt.needs_review = true AND wt.sync_status = 'pending'
       ORDER BY wt.transaction_date DESC`
    );
    return result.rows;
  },

  /**
   * Get all transactions with a specific sync status
   * @param {string} status - Sync status ('pending', 'processed', 'failed', 'skipped')
   * @returns {Promise<Array>} List of transactions
   */
  async getByStatus(status) {
    const result = await pool.query(
      `SELECT wt.*, e.name as employee_name, ent.id as entry_id
       FROM wise_transactions wt
       LEFT JOIN employees e ON wt.matched_employee_id = e.id
       LEFT JOIN entries ent ON ent.wise_transaction_id = wt.wise_transaction_id
       WHERE wt.sync_status = $1
       ORDER BY wt.transaction_date DESC`,
      [status]
    );
    return result.rows;
  },

  /**
   * Update transaction status and processing info
   * @param {string} wiseTransactionId - Wise transaction ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated transaction
   */
  async updateStatus(wiseTransactionId, updates) {
    const {
      syncStatus,
      processingError,
      entryId,
      classifiedCategory,
      matchedEmployeeId,
      confidenceScore,
      needsReview
    } = updates;

    const setClauses = [];
    const values = [];
    let paramCounter = 1;

    if (syncStatus !== undefined) {
      setClauses.push(`sync_status = $${paramCounter++}`);
      values.push(syncStatus);
    }

    if (processingError !== undefined) {
      setClauses.push(`processing_error = $${paramCounter++}`);
      values.push(processingError);
    }

    if (entryId !== undefined) {
      setClauses.push(`entry_id = $${paramCounter++}`);
      values.push(entryId);
    }

    if (classifiedCategory !== undefined) {
      setClauses.push(`classified_category = $${paramCounter++}`);
      values.push(classifiedCategory);
    }

    if (matchedEmployeeId !== undefined) {
      setClauses.push(`matched_employee_id = $${paramCounter++}`);
      values.push(matchedEmployeeId);
    }

    if (confidenceScore !== undefined) {
      setClauses.push(`confidence_score = $${paramCounter++}`);
      values.push(confidenceScore);
    }

    if (needsReview !== undefined) {
      setClauses.push(`needs_review = $${paramCounter++}`);
      values.push(needsReview);
    }

    if (syncStatus === 'processed' || syncStatus === 'failed') {
      setClauses.push(`processed_at = CURRENT_TIMESTAMP`);
    }

    values.push(wiseTransactionId);

    const result = await pool.query(
      `UPDATE wise_transactions
       SET ${setClauses.join(', ')}
       WHERE wise_transaction_id = $${paramCounter}
       RETURNING *`,
      values
    );

    return result.rows[0];
  },

  /**
   * Mark transaction as processed and link to entry
   * @param {string} wiseTransactionId - Wise transaction ID
   * @param {number} entryId - Created entry ID
   * @returns {Promise<Object>} Updated transaction
   */
  async markAsProcessed(wiseTransactionId, entryId) {
    return this.updateStatus(wiseTransactionId, {
      syncStatus: 'processed',
      entryId,
      processingError: null
    });
  },

  /**
   * Mark transaction as failed with error message
   * @param {string} wiseTransactionId - Wise transaction ID
   * @param {string} errorMessage - Error message
   * @returns {Promise<Object>} Updated transaction
   */
  async markAsFailed(wiseTransactionId, errorMessage) {
    return this.updateStatus(wiseTransactionId, {
      syncStatus: 'failed',
      processingError: errorMessage
    });
  },

  /**
   * Mark transaction as skipped (not relevant for accounting)
   * @param {string} wiseTransactionId - Wise transaction ID
   * @returns {Promise<Object>} Updated transaction
   */
  async markAsSkipped(wiseTransactionId) {
    return this.updateStatus(wiseTransactionId, {
      syncStatus: 'skipped'
    });
  },

  /**
   * Check if transaction already exists (deduplication)
   * @param {string} wiseTransactionId - Wise transaction ID
   * @returns {Promise<boolean>} True if transaction exists
   */
  async exists(wiseTransactionId) {
    const result = await pool.query(
      'SELECT 1 FROM wise_transactions WHERE wise_transaction_id = $1',
      [wiseTransactionId]
    );
    return result.rows.length > 0;
  },

  /**
   * Get transactions within date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} List of transactions
   */
  async getByDateRange(startDate, endDate) {
    const result = await pool.query(
      `SELECT wt.*, e.name as employee_name, ent.id as entry_id
       FROM wise_transactions wt
       LEFT JOIN employees e ON wt.matched_employee_id = e.id
       LEFT JOIN entries ent ON ent.wise_transaction_id = wt.wise_transaction_id
       WHERE wt.transaction_date BETWEEN $1 AND $2
       ORDER BY wt.transaction_date DESC`,
      [startDate, endDate]
    );
    return result.rows;
  },

  /**
   * Get sync statistics
   * @returns {Promise<Object>} Statistics about synced transactions
   */
  async getStats() {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN sync_status = 'processed' THEN 1 ELSE 0 END) as processed_count,
        SUM(CASE WHEN sync_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN sync_status = 'skipped' THEN 1 ELSE 0 END) as skipped_count,
        SUM(CASE WHEN needs_review = true THEN 1 ELSE 0 END) as needs_review_count,
        AVG(CASE WHEN confidence_score > 0 THEN confidence_score END) as avg_confidence_score
      FROM wise_transactions
    `);
    return result.rows[0];
  },

  /**
   * Delete transaction by Wise transaction ID
   * @param {string} wiseTransactionId - Wise transaction ID
   * @returns {Promise<Object>} Deleted transaction
   */
  async delete(wiseTransactionId) {
    const result = await pool.query(
      'DELETE FROM wise_transactions WHERE wise_transaction_id = $1 RETURNING *',
      [wiseTransactionId]
    );
    return result.rows[0];
  },

  /**
   * Create audit log entry
   * @param {Object} logData - Audit log data
   * @returns {Promise<Object>} Created audit log entry
   */
  async createAuditLog(logData) {
    const {
      wiseTransactionId,
      entryId,
      action,
      performedBy,
      oldValues,
      newValues,
      notes
    } = logData;

    const result = await pool.query(
      `INSERT INTO wise_sync_audit_log (
        wise_transaction_id, entry_id, action, performed_by,
        old_values, new_values, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        wiseTransactionId,
        entryId,
        action,
        performedBy,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        notes
      ]
    );

    return result.rows[0];
  }
};

module.exports = WiseTransactionModel;
