const pool = require('../config/database');
const WiseTransactionModel = require('../models/wiseTransactionModel');
const wiseClassifier = require('./wiseClassifier');

/**
 * Wise Transaction Processor
 * Shared processor for all Wise transaction sync methods (CSV, API, Webhooks)
 *
 * Handles:
 * - Transaction normalization from different sources
 * - Deduplication by wise_transaction_id
 * - Update detection (status/amount changes)
 * - Classification using wiseClassifier
 * - Auto-entry creation for high confidence (≥40%)
 * - Audit logging for all operations
 */
class WiseTransactionProcessor {
  /**
   * Process a single transaction from any source
   * @param {Object} txnData - Normalized transaction data
   * @param {string} source - Source of transaction ('csv', 'api', 'webhook')
   * @returns {Promise<Object>} Processing result with statistics
   */
  async processTransaction(txnData, source = 'unknown') {
    const startTime = Date.now();
    const result = {
      success: false,
      action: null,
      transactionId: txnData.wise_transaction_id,
      entryCreated: false,
      entryId: null,
      confidence: 0,
      error: null,
      source,
      processingTimeMs: 0
    };

    try {
      // Validate required fields
      this._validateTransactionData(txnData);

      // Check if transaction already exists
      const existing = await WiseTransactionModel.getByWiseId(txnData.wise_transaction_id);

      if (existing) {
        // Transaction exists - check if update needed
        const updateResult = await this._handleExistingTransaction(existing, txnData, source);
        Object.assign(result, updateResult);
      } else {
        // New transaction - create and process
        const createResult = await this._handleNewTransaction(txnData, source);
        Object.assign(result, createResult);
      }

      result.success = true;
      result.processingTimeMs = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error(`Error processing transaction ${txnData.wise_transaction_id}:`, error);
      result.error = error.message;
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Process multiple transactions in batch
   * @param {Array} transactions - Array of transaction data
   * @param {string} source - Source of transactions
   * @returns {Promise<Object>} Batch processing statistics
   */
  async processBatch(transactions, source = 'unknown') {
    const stats = {
      total: transactions.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      entriesCreated: 0,
      startTime: new Date(),
      endTime: null,
      durationMs: 0,
      errorDetails: []
    };

    console.log(`Starting batch processing: ${transactions.length} transactions from ${source}`);

    for (const txnData of transactions) {
      try {
        const result = await this.processTransaction(txnData, source);

        if (result.success) {
          if (result.action === 'created') {
            stats.imported++;
          } else if (result.action === 'updated') {
            stats.updated++;
          } else if (result.action === 'skipped') {
            stats.skipped++;
          }

          if (result.entryCreated) {
            stats.entriesCreated++;
          }
        } else {
          stats.errors++;
          stats.errorDetails.push({
            transactionId: txnData.wise_transaction_id,
            error: result.error
          });
        }
      } catch (error) {
        stats.errors++;
        stats.errorDetails.push({
          transactionId: txnData.wise_transaction_id,
          error: error.message
        });
        console.error(`Batch processing error for transaction ${txnData.wise_transaction_id}:`, error);
      }
    }

    stats.endTime = new Date();
    stats.durationMs = stats.endTime - stats.startTime;

    console.log(`Batch processing complete:`, {
      imported: stats.imported,
      updated: stats.updated,
      skipped: stats.skipped,
      errors: stats.errors,
      entriesCreated: stats.entriesCreated,
      durationMs: stats.durationMs
    });

    return stats;
  }

  /**
   * Handle existing transaction (check for updates)
   * @private
   */
  async _handleExistingTransaction(existing, txnData, source) {
    const result = {
      action: 'skipped',
      transactionDbId: existing.id,
      confidence: existing.confidence_score || 0
    };

    // Check if significant changes occurred
    const hasChanges = this._detectChanges(existing, txnData);

    if (hasChanges.changed) {
      console.log(`Transaction ${txnData.wise_transaction_id} has changes:`, hasChanges.changes);

      // Update transaction record
      await pool.query(
        `UPDATE wise_transactions
         SET state = $1, amount = $2, description = $3,
             merchant_name = $4, raw_payload = $5, updated_at = CURRENT_TIMESTAMP
         WHERE wise_transaction_id = $6`,
        [
          txnData.state,
          txnData.amount,
          txnData.description,
          txnData.merchant_name,
          JSON.stringify(txnData.raw_payload),
          txnData.wise_transaction_id
        ]
      );

      // Create audit log entry
      await WiseTransactionModel.createAuditLog({
        wiseTransactionId: txnData.wise_transaction_id,
        entryId: existing.entry_id,
        action: 'updated',
        notes: `Transaction updated from ${source}: ${hasChanges.changes.join(', ')}`,
        oldValues: {
          state: existing.state,
          amount: existing.amount,
          description: existing.description
        },
        newValues: {
          state: txnData.state,
          amount: txnData.amount,
          description: txnData.description
        }
      });

      result.action = 'updated';
      console.log(`✓ Transaction ${txnData.wise_transaction_id} updated`);
    } else {
      console.log(`Transaction ${txnData.wise_transaction_id} already exists - no changes`);
    }

    return result;
  }

  /**
   * Handle new transaction (classify and optionally create entry)
   * @private
   */
  async _handleNewTransaction(txnData, source) {
    const result = {
      action: 'created',
      transactionDbId: null,
      confidence: 0,
      entryCreated: false,
      entryId: null
    };

    try {
      // Step 1: Classify transaction
      console.log(`Classifying transaction ${txnData.wise_transaction_id}...`);
      const classification = await wiseClassifier.classifyTransaction({
        type: txnData.type,
        amount: txnData.amount,
        description: txnData.description,
        merchantName: txnData.merchant_name,
        referenceNumber: txnData.reference_number,
        transactionDate: txnData.transaction_date
      });

      console.log(`Classification result:`, {
        category: classification.category,
        employeeId: classification.employeeId,
        confidence: classification.confidenceScore,
        needsReview: classification.needsReview
      });

      // Step 2: Store transaction in wise_transactions table
      const savedTransaction = await WiseTransactionModel.create({
        wiseTransactionId: txnData.wise_transaction_id,
        wiseResourceId: txnData.wise_resource_id,
        profileId: txnData.profile_id,
        accountId: txnData.account_id,
        type: txnData.type,
        state: txnData.state,
        amount: txnData.amount,
        currency: txnData.currency,
        description: txnData.description,
        merchantName: txnData.merchant_name,
        referenceNumber: txnData.reference_number,
        transactionDate: txnData.transaction_date,
        valueDate: txnData.value_date,
        syncStatus: 'pending',
        classifiedCategory: classification.category,
        matchedEmployeeId: classification.employeeId,
        confidenceScore: classification.confidenceScore,
        needsReview: classification.needsReview,
        rawPayload: txnData.raw_payload
      });

      result.transactionDbId = savedTransaction.id;
      result.confidence = classification.confidenceScore;

      console.log(`✓ Transaction saved to database (ID: ${savedTransaction.id})`);

      // Step 3: Auto-create entry if confidence ≥ 40%
      if (classification.confidenceScore >= 40) {
        console.log(`Confidence ${classification.confidenceScore}% ≥ 40% - auto-creating entry...`);

        const entryResult = await this._createEntryFromTransaction(
          savedTransaction,
          classification,
          txnData
        );

        if (entryResult.success) {
          // Link entry back to transaction
          await pool.query(
            `UPDATE wise_transactions SET entry_id = $1, sync_status = 'processed', processed_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [entryResult.entryId, savedTransaction.id]
          );

          result.entryCreated = true;
          result.entryId = entryResult.entryId;

          console.log(`✓ Entry created (ID: ${entryResult.entryId})`);

          // Create audit log
          await WiseTransactionModel.createAuditLog({
            wiseTransactionId: txnData.wise_transaction_id,
            entryId: entryResult.entryId,
            action: 'auto_created',
            notes: `Entry auto-created from ${source} with ${classification.confidenceScore}% confidence`,
            newValues: {
              category: classification.category,
              employeeId: classification.employeeId,
              amount: txnData.amount,
              currency: txnData.currency
            }
          });
        } else {
          console.error(`✗ Entry creation failed for transaction ${txnData.wise_transaction_id}:`, entryResult.error);
          // Update transaction with error status
          await pool.query(
            `UPDATE wise_transactions SET sync_status = 'failed', processed_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [savedTransaction.id]
          );
        }
      } else {
        console.log(`Confidence ${classification.confidenceScore}% < 40% - flagged for manual review`);
      }

      console.log(`✓ Transaction ${txnData.wise_transaction_id} processed successfully`);

    } catch (error) {
      console.error(`Error creating transaction ${txnData.wise_transaction_id}:`, error);
      throw error;
    }

    return result;
  }

  /**
   * Create accounting entry from transaction
   * @private
   */
  async _createEntryFromTransaction(transaction, classification, txnData) {
    try {
      console.log('[Entry Creation] Starting entry creation for transaction:', transaction.wise_transaction_id);

      // Determine entry type and category based on transaction type
      let entryType, category;

      if (transaction.type === 'DEBIT') {
        // Outgoing payment = expense
        entryType = 'expense';
        category = this._mapCategoryToExpense(classification.category);
      } else {
        // Incoming payment = income
        entryType = 'income';
        category = this._mapCategoryToIncome(classification.category);
      }

      // All Wise transactions are historical facts - mark as completed
      const status = 'completed';

      // Get converted USD amount (use amount directly if USD, otherwise would need exchange rate)
      const amountUsd = transaction.currency === 'USD'
        ? Math.abs(transaction.amount)
        : null; // TODO: Implement currency conversion if needed

      // Calculate base_amount (required field - same as total for Wise transactions)
      const amount = Math.abs(transaction.amount);

      console.log('[Entry Creation] Entry data:', {
        description: txnData.description || txnData.merchant_name || 'Wise Transaction',
        type: entryType,
        amount: amount,
        category: category,
        status: status,
        employeeId: classification.employeeId,
        currency: transaction.currency,
        confidence: classification.confidenceScore
      });

      // Create entry
      const entryResult = await pool.query(
        `INSERT INTO entries (
          description, type, base_amount, total, category, entry_date, status,
          employee_id, wise_transaction_id, currency, amount_usd
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          txnData.description || txnData.merchant_name || 'Wise Transaction',
          entryType,
          amount,           // base_amount (required, NOT NULL)
          amount,           // total (required, NOT NULL)
          category,
          transaction.transaction_date,
          status,
          classification.employeeId || null,
          transaction.wise_transaction_id,
          transaction.currency,
          amountUsd
        ]
      );

      console.log('[Entry Creation] SUCCESS - Entry created:', {
        entryId: entryResult.rows[0].id,
        type: entryResult.rows[0].type,
        amount: entryResult.rows[0].total,
        category: entryResult.rows[0].category
      });

      return {
        success: true,
        entryId: entryResult.rows[0].id,
        entry: entryResult.rows[0]
      };

    } catch (error) {
      console.error('[Entry Creation] FAILED:', error.message);
      console.error('[Entry Creation] Error details:', error);
      console.error('[Entry Creation] Transaction data:', {
        wiseTransactionId: transaction.wise_transaction_id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        description: txnData.description,
        merchantName: txnData.merchant_name
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Map classified category to expense category
   * @private
   */
  _mapCategoryToExpense(classifiedCategory) {
    const categoryMap = {
      'Employee': 'salary',
      'Software': 'software',
      'Administration': 'office_supplies',
      'Marketing': 'marketing',
      'Professional Services': 'professional_services',
      'Bank Fees': 'bank_fees',
      'Other Expenses': 'other_expenses',
      // Wise CSV categories
      'Groceries': 'groceries',
      'Restaurants': 'meals',
      'Transportation': 'travel',
      'Utilities': 'utilities',
      'Shopping': 'office_supplies',
      'Entertainment': 'entertainment'
    };

    return categoryMap[classifiedCategory] || 'other_expenses';
  }

  /**
   * Map classified category to income category
   * @private
   */
  _mapCategoryToIncome(classifiedCategory) {
    const categoryMap = {
      'Client Payment': 'client_payment',
      'Contract Payment': 'contract_payment',
      'Other Income': 'other_income'
    };

    return categoryMap[classifiedCategory] || 'other_income';
  }

  /**
   * Detect if transaction data has changed
   * @private
   */
  _detectChanges(existing, newData) {
    const changes = [];
    let changed = false;

    if (existing.state !== newData.state) {
      changes.push(`state: ${existing.state} → ${newData.state}`);
      changed = true;
    }

    if (parseFloat(existing.amount) !== parseFloat(newData.amount)) {
      changes.push(`amount: ${existing.amount} → ${newData.amount}`);
      changed = true;
    }

    if (existing.description !== newData.description) {
      changes.push(`description updated`);
      changed = true;
    }

    return { changed, changes };
  }

  /**
   * Validate transaction data has required fields
   * @private
   */
  _validateTransactionData(txnData) {
    const required = ['wise_transaction_id', 'type', 'state', 'amount', 'currency', 'transaction_date'];

    for (const field of required) {
      if (!txnData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate transaction type
    if (!['DEBIT', 'CREDIT'].includes(txnData.type)) {
      throw new Error(`Invalid transaction type: ${txnData.type} (must be DEBIT or CREDIT)`);
    }

    // Validate amount is a number
    if (isNaN(parseFloat(txnData.amount))) {
      throw new Error(`Invalid amount: ${txnData.amount}`);
    }

    // Validate currency is 3 characters
    if (!/^[A-Z]{3}$/.test(txnData.currency)) {
      throw new Error(`Invalid currency: ${txnData.currency} (must be 3-letter code)`);
    }
  }

  /**
   * Get processing statistics
   * @returns {Promise<Object>} Processing statistics
   */
  async getStats() {
    const stats = await WiseTransactionModel.getStats();
    return {
      totalTransactions: parseInt(stats.total_transactions) || 0,
      pending: parseInt(stats.pending_count) || 0,
      processed: parseInt(stats.processed_count) || 0,
      failed: parseInt(stats.failed_count) || 0,
      skipped: parseInt(stats.skipped_count) || 0,
      needsReview: parseInt(stats.needs_review_count) || 0,
      avgConfidence: parseFloat(stats.avg_confidence_score) || 0
    };
  }
}

module.exports = new WiseTransactionProcessor();
