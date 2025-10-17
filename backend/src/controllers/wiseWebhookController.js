const wiseService = require('../services/wiseService');
const wiseClassifier = require('../services/wiseClassifier');
const WiseTransactionModel = require('../models/wiseTransactionModel');
const EntryModel = require('../models/entryModel');
const WiseSignatureValidator = require('../utils/wiseSignatureValidator');

const WiseWebhookController = {
  /**
   * Handle incoming Wise webhook
   * POST /api/wise/webhook
   */
  async handleWebhook(req, res, next) {
    try {
      // Validate webhook signature
      const webhookSecret = process.env.WISE_WEBHOOK_SECRET;

      if (webhookSecret) {
        const isValid = WiseSignatureValidator.validateRequest(req, webhookSecret);

        if (!isValid) {
          console.error('Invalid Wise webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } else {
        console.warn('WARN: WISE_WEBHOOK_SECRET not set - skipping signature validation');
      }

      const payload = req.body;

      // Handle test webhook events from Wise
      if (payload.event_type === 'test') {
        console.log('Received Wise test webhook');
        return res.json({ status: 'ok', message: 'Test webhook received' });
      }

      // Parse webhook payload
      const transaction = wiseService.parseWebhookPayload(payload);

      if (!transaction.wiseTransactionId) {
        return res.status(400).json({ error: 'Invalid webhook payload: missing transaction ID' });
      }

      // Check for duplicates
      const exists = await WiseTransactionModel.exists(transaction.wiseTransactionId);

      if (exists) {
        console.log(`Transaction ${transaction.wiseTransactionId} already processed - skipping`);
        return res.json({ status: 'ok', message: 'Transaction already processed' });
      }

      // Process transaction asynchronously
      // Respond quickly to Wise (they expect 2xx within 5 seconds)
      res.json({ status: 'ok', message: 'Webhook received and queued for processing' });

      // Process in background
      this.processTransaction(transaction).catch(err => {
        console.error(`Error processing transaction ${transaction.wiseTransactionId}:`, err);
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * Process a Wise transaction (classification and entry creation)
   * @param {Object} transaction - Parsed transaction data
   */
  async processTransaction(transaction) {
    try {
      // Only process completed transactions
      if (transaction.state !== 'COMPLETED') {
        console.log(`Skipping non-completed transaction: ${transaction.wiseTransactionId} (state: ${transaction.state})`);
        await WiseTransactionModel.create({
          ...transaction,
          syncStatus: 'skipped',
          needsReview: false
        });
        return;
      }

      // Classify the transaction
      const classification = await wiseClassifier.classifyTransaction(transaction);

      // Save to wise_transactions table
      const wiseTransaction = await WiseTransactionModel.create({
        ...transaction,
        classifiedCategory: classification.category,
        matchedEmployeeId: classification.employeeId,
        confidenceScore: classification.confidenceScore,
        needsReview: classification.needsReview,
        syncStatus: classification.needsReview ? 'pending' : 'pending' // Will be updated after entry creation
      });

      console.log(`Wise transaction saved: ${transaction.wiseTransactionId} - Category: ${classification.category}, Confidence: ${classification.confidenceScore}%, Needs Review: ${classification.needsReview}`);
      console.log(`Reasoning: ${classification.reasoning.join('; ')}`);

      // If confidence is high and doesn't need review, create entry automatically
      if (!classification.needsReview && classification.confidenceScore >= 80) {
        await this.createEntryFromTransaction(wiseTransaction, classification);
      }

    } catch (error) {
      console.error(`Error processing transaction ${transaction.wiseTransactionId}:`, error);
      await WiseTransactionModel.markAsFailed(transaction.wiseTransactionId, error.message);
    }
  },

  /**
   * Create an accounting entry from a Wise transaction
   * @param {Object} wiseTransaction - Wise transaction record from database
   * @param {Object} classification - Classification result
   */
  async createEntryFromTransaction(wiseTransaction, classification) {
    try {
      const entryType = wiseTransaction.type === 'CREDIT' ? 'income' : 'expense';
      const entryDate = new Date(wiseTransaction.transaction_date);

      // Build entry description
      let description = wiseTransaction.merchant_name || wiseTransaction.description || 'Wise Transaction';

      // If matched to employee, include employee name
      if (classification.employeeId) {
        const employeeResult = await require('../config/database').query(
          'SELECT name FROM employees WHERE id = $1',
          [classification.employeeId]
        );
        if (employeeResult.rows[0]) {
          description = `Salary - ${employeeResult.rows[0].name}`;
        }
      }

      // Create entry
      const entry = await EntryModel.create({
        type: entryType,
        category: classification.category,
        description: description,
        detail: `Auto-synced from Wise: ${wiseTransaction.description || ''}\nReference: ${wiseTransaction.reference_number || 'N/A'}`,
        baseAmount: wiseTransaction.amount,
        total: wiseTransaction.amount,
        entryDate: entryDate,
        status: 'completed',
        employeeId: classification.employeeId || null
      });

      // Link entry to Wise transaction
      await require('../config/database').query(
        'UPDATE entries SET wise_transaction_id = $1, needs_review = $2, auto_matched_confidence = $3 WHERE id = $4',
        [wiseTransaction.wise_transaction_id, classification.needsReview, classification.confidenceScore, entry.id]
      );

      // Update Wise transaction status
      await WiseTransactionModel.markAsProcessed(wiseTransaction.wise_transaction_id, entry.id);

      // Create audit log
      await WiseTransactionModel.createAuditLog({
        wiseTransactionId: wiseTransaction.wise_transaction_id,
        entryId: entry.id,
        action: 'created',
        performedBy: 'system',
        newValues: { entry, classification },
        notes: `Auto-created entry with ${classification.confidenceScore}% confidence`
      });

      console.log(`✅ Entry created for Wise transaction ${wiseTransaction.wise_transaction_id}: ${description} (${entryType} ${wiseTransaction.currency} ${wiseTransaction.amount})`);

    } catch (error) {
      console.error(`Error creating entry for transaction ${wiseTransaction.wise_transaction_id}:`, error);
      await WiseTransactionModel.markAsFailed(wiseTransaction.wise_transaction_id, `Entry creation failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Manual sync of Wise transactions
   * GET /api/wise/sync
   */
  async manualSync(req, res, next) {
    try {
      const days = parseInt(req.query.days) || 7;

      console.log(`Starting manual Wise sync for last ${days} days...`);

      // Fetch recent transactions from Wise
      const transactions = await wiseService.getRecentTransactions(days);

      console.log(`Fetched ${transactions.length} transactions from Wise`);

      const results = {
        total: transactions.length,
        new: 0,
        skipped: 0,
        processed: 0,
        failed: 0
      };

      // Process each transaction
      for (const rawTransaction of transactions) {
        try {
          // Parse transaction
          const transaction = {
            wiseTransactionId: rawTransaction.referenceNumber || `${rawTransaction.date}_${rawTransaction.amount.value}`,
            wiseResourceId: rawTransaction.resourceId,
            profileId: process.env.WISE_PROFILE_ID,
            accountId: rawTransaction.accountId,
            type: rawTransaction.type, // 'CREDIT' or 'DEBIT'
            state: rawTransaction.status || 'COMPLETED',
            amount: Math.abs(rawTransaction.amount.value),
            currency: rawTransaction.amount.currency,
            description: rawTransaction.details?.description || rawTransaction.description,
            merchantName: rawTransaction.details?.merchant?.name,
            referenceNumber: rawTransaction.referenceNumber,
            transactionDate: rawTransaction.date,
            valueDate: rawTransaction.date,
            rawPayload: rawTransaction
          };

          // Check if already exists
          const exists = await WiseTransactionModel.exists(transaction.wiseTransactionId);

          if (exists) {
            results.skipped++;
            continue;
          }

          results.new++;

          // Process transaction
          await this.processTransaction(transaction);
          results.processed++;

        } catch (error) {
          console.error(`Error processing transaction:`, error);
          results.failed++;
        }
      }

      res.json({
        success: true,
        results,
        message: `Sync complete: ${results.new} new transactions, ${results.processed} processed, ${results.skipped} already existed, ${results.failed} failed`
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * Get transactions pending review
   * GET /api/wise/pending-review
   */
  async getPendingReview(req, res, next) {
    try {
      const transactions = await WiseTransactionModel.getPendingReview();

      res.json(transactions);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sync statistics
   * GET /api/wise/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await WiseTransactionModel.getStats();

      res.json(stats);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Approve/review a transaction and create entry
   * POST /api/wise/review/:id
   */
  async reviewTransaction(req, res, next) {
    try {
      const { id } = req.params;
      const { category, employeeId, action } = req.body;

      const wiseTransaction = await WiseTransactionModel.getById(id);

      if (!wiseTransaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (action === 'skip') {
        // Mark as skipped
        await WiseTransactionModel.markAsSkipped(wiseTransaction.wise_transaction_id);
        return res.json({ success: true, message: 'Transaction skipped' });
      }

      if (action === 'approve') {
        // Update classification if provided
        if (category || employeeId !== undefined) {
          await WiseTransactionModel.updateStatus(wiseTransaction.wise_transaction_id, {
            classifiedCategory: category || wiseTransaction.classified_category,
            matchedEmployeeId: employeeId,
            needsReview: false
          });
        }

        // Create entry
        const updatedTransaction = await WiseTransactionModel.getById(id);
        const classification = {
          category: updatedTransaction.classified_category,
          employeeId: updatedTransaction.matched_employee_id,
          confidenceScore: 100, // Manual review = 100% confidence
          needsReview: false
        };

        await this.createEntryFromTransaction(updatedTransaction, classification);

        res.json({ success: true, message: 'Transaction approved and entry created' });
      } else {
        res.status(400).json({ error: 'Invalid action. Use "approve" or "skip"' });
      }

    } catch (error) {
      next(error);
    }
  },

  /**
   * Test Wise API connection
   * GET /api/wise/test-connection
   */
  async testConnection(req, res, next) {
    try {
      const isConnected = await wiseService.testConnection();

      if (isConnected) {
        res.json({ success: true, message: 'Wise API connection successful' });
      } else {
        res.status(500).json({ success: false, message: 'Wise API connection failed' });
      }
    } catch (error) {
      next(error);
    }
  }
};

module.exports = WiseWebhookController;
