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
      const payload = req.body;

      // ============================================================================
      // ENHANCED WEBHOOK LOGGING - Capture everything Wise sends
      // ============================================================================
      console.log('\n' + '╔' + '═'.repeat(78) + '╗');
      console.log('║' + ' '.repeat(25) + 'WISE WEBHOOK RECEIVED' + ' '.repeat(32) + '║');
      console.log('╚' + '═'.repeat(78) + '╝\n');

      console.log('📅 Timestamp:', new Date().toISOString());
      console.log('🌐 IP Address:', req.ip || req.connection?.remoteAddress || 'unknown');
      console.log('🔗 URL:', req.originalUrl || req.url);
      console.log('📨 Method:', req.method);

      console.log('\n📋 Headers:');
      Object.entries(req.headers).forEach(([key, value]) => {
        // Mask sensitive values but show structure
        if (key.toLowerCase().includes('signature') || key.toLowerCase().includes('authorization')) {
          console.log(`  ${key}: ${value.substring(0, 30)}...`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      });

      console.log('\n📦 Payload:');
      console.log(JSON.stringify(payload, null, 2));

      console.log('\n' + '─'.repeat(80) + '\n');
      // ============================================================================

      // Handle empty/test requests (during webhook registration)
      // Wise expects empty response body
      if (!payload || Object.keys(payload).length === 0) {
        console.log('ℹ️  Empty payload - Webhook registration test');
        return res.status(200).send();
      }

      // Handle test webhook events from Wise
      // Wise expects empty response body
      if (payload.event_type === 'test' || payload.data?.resource?.type === 'test') {
        console.log('ℹ️  Test webhook event detected');
        console.log('✅ Responding with 200 OK\n');
        return res.status(200).send();
      }

      // Validate webhook signature for real events
      // Skip signature validation if X-Test-Notification header is present (webhook registration)
      const isTestNotification = req.headers['x-test-notification'] === 'true';

      if (isTestNotification) {
        console.log('ℹ️  X-Test-Notification header present - Webhook registration test');
        console.log('✅ Responding with 200 OK\n');
        return res.status(200).send();
      }

      const webhookSecret = process.env.WISE_WEBHOOK_SECRET;

      console.log('\n🔐 Signature Validation:');
      if (webhookSecret) {
        const isValid = WiseSignatureValidator.validateRequest(req, webhookSecret);

        if (!isValid) {
          console.error('❌ Invalid signature - Request rejected\n');
          return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('✅ Signature valid');
      } else {
        console.warn('⚠️  WISE_WEBHOOK_SECRET not set - Skipping signature validation (INSECURE!)');
      }

      // Parse webhook payload
      console.log('\n⚙️  Parsing webhook payload...');
      const transaction = wiseService.parseWebhookPayload(payload);

      if (!transaction.wiseTransactionId) {
        console.error('❌ Invalid payload: missing transaction ID\n');
        return res.status(400).json({ error: 'Invalid webhook payload: missing transaction ID' });
      }

      console.log(`📝 Transaction ID: ${transaction.wiseTransactionId}`);
      console.log(`💰 Amount: ${transaction.currency} ${transaction.amount}`);
      console.log(`📊 Type: ${transaction.type}`);
      console.log(`📅 Date: ${transaction.transactionDate}`);

      // Check for duplicates
      const exists = await WiseTransactionModel.exists(transaction.wiseTransactionId);

      if (exists) {
        console.log(`ℹ️  Transaction ${transaction.wiseTransactionId} already exists - Skipping`);
        console.log('✅ Responding with 200 OK\n');
        return res.status(200).send();
      }

      console.log('🆕 New transaction - Processing in background');

      // Process transaction asynchronously
      // Respond quickly to Wise (they expect 2xx within 5 seconds)
      // Wise expects empty response body
      console.log('✅ Responding with 200 OK (processing asynchronously)\n');
      res.status(200).send();

      // Process in background
      console.log('🔄 Starting background processing...');
      this.processTransaction(transaction).catch(err => {
        console.error(`❌ Error processing transaction ${transaction.wiseTransactionId}:`, err);
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
   * GET /api/wise/sync?days=7              - Last N days
   * GET /api/wise/sync?from=2024-01-01&to=2025-10-17  - Custom range
   * GET /api/wise/sync?all=true            - All history (last 2 years max)
   */
  async manualSync(req, res, next) {
    try {
      let intervalStart, intervalEnd;

      // Determine date range based on query parameters
      if (req.query.all === 'true') {
        // All history mode: fetch last 2 years (Wise API limitation)
        intervalStart = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
        intervalEnd = new Date().toISOString();
        console.log('Starting manual Wise sync for ALL HISTORY (last 2 years)...');
      } else if (req.query.from && req.query.to) {
        // Custom date range
        intervalStart = new Date(req.query.from).toISOString();
        intervalEnd = new Date(req.query.to).toISOString();
        console.log(`Starting manual Wise sync from ${req.query.from} to ${req.query.to}...`);
      } else {
        // Days mode (default)
        const days = parseInt(req.query.days) || 7;
        intervalStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        intervalEnd = new Date().toISOString();
        console.log(`Starting manual Wise sync for last ${days} days...`);
      }

      console.log(`WISE_API_TOKEN configured: ${!!process.env.WISE_API_TOKEN}`);
      console.log(`WISE_PROFILE_ID: ${process.env.WISE_PROFILE_ID}`);
      console.log(`Date range: ${intervalStart} to ${intervalEnd}`);

      // Fetch transactions from Wise
      let transactions;
      try {
        transactions = await wiseService.getAllTransactions({ intervalStart, intervalEnd });
        console.log(`Fetched ${transactions.length} transactions from Wise`);
      } catch (wiseError) {
        console.error('Error fetching transactions from Wise API:', wiseError.message);
        console.error('Wise API error details:', {
          status: wiseError.response?.status,
          statusText: wiseError.response?.statusText,
          data: wiseError.response?.data
        });

        // Get configuration status for diagnostics
        const wiseScaSigner = require('../utils/wiseScaSigner');
        const configStatus = {
          apiTokenConfigured: !!process.env.WISE_API_TOKEN,
          profileIdConfigured: !!process.env.WISE_PROFILE_ID,
          privateKeyConfigured: !!process.env.WISE_PRIVATE_KEY,
          scaSignerConfigured: wiseScaSigner.isConfigured()
        };

        return res.status(500).json({
          success: false,
          error: 'Failed to fetch transactions from Wise API',
          details: wiseError.message,
          wiseApiStatus: wiseError.response?.status,
          wiseApiError: wiseError.response?.data,
          configStatus: configStatus,
          hint: !configStatus.privateKeyConfigured
            ? 'WISE_PRIVATE_KEY environment variable is not set. Transactions API requires SCA authentication with private key.'
            : !configStatus.scaSignerConfigured
            ? 'SCA signer is not properly configured. Check WISE_PRIVATE_KEY format.'
            : `Wise API returned error: ${wiseError.response?.status || 'Unknown'}. Check if the private key matches the public key uploaded to Wise.`
        });
      }

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
          console.error('Transaction data:', JSON.stringify(rawTransaction, null, 2));
          console.error('Error stack:', error.stack);
          results.failed++;
        }
      }

      res.json({
        success: true,
        results,
        message: `Sync complete: ${results.new} new transactions, ${results.processed} processed, ${results.skipped} already existed, ${results.failed} failed`
      });

    } catch (error) {
      console.error('Manual sync error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
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
   * Get diagnostic information about Wise integration
   * GET /api/wise/diagnostics
   */
  async getDiagnostics(req, res, next) {
    try {
      const pool = require('../db');
      const wiseScaSigner = require('../utils/wiseScaSigner');

      // Get configuration status first (always works)
      const configuration = {
        api_token_set: !!process.env.WISE_API_TOKEN,
        profile_id: process.env.WISE_PROFILE_ID || 'NOT SET',
        private_key_set: !!process.env.WISE_PRIVATE_KEY,
        sca_configured: wiseScaSigner.isConfigured(),
        webhook_secret_set: !!process.env.WISE_WEBHOOK_SECRET
      };

      // Try to get database counts (may fail if tables don't exist)
      let database = {};
      try {
        const transactionsResult = await pool.query('SELECT COUNT(*) as count FROM wise_transactions');
        const auditLogResult = await pool.query('SELECT COUNT(*) as count FROM wise_sync_audit_log');
        const pendingResult = await pool.query('SELECT COUNT(*) as count FROM wise_transactions WHERE needs_review = true');
        const processedResult = await pool.query('SELECT COUNT(*) as count FROM wise_transactions WHERE sync_status = $1', ['processed']);
        const recentResult = await pool.query('SELECT transaction_date, type, amount, currency, description FROM wise_transactions ORDER BY transaction_date DESC LIMIT 1');

        database = {
          total_transactions: parseInt(transactionsResult.rows[0].count),
          pending_review: parseInt(pendingResult.rows[0].count),
          processed: parseInt(processedResult.rows[0].count),
          audit_log_entries: parseInt(auditLogResult.rows[0].count),
          most_recent_transaction: recentResult.rows[0] || null,
          tables_exist: true
        };
      } catch (dbError) {
        database = {
          error: 'Database tables may not exist or migration not run',
          details: dbError.message,
          tables_exist: false
        };
      }

      res.json({
        success: true,
        configuration,
        database
      });
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
      // Get configuration status
      const wiseScaSigner = require('../utils/wiseScaSigner');
      const config = {
        apiTokenConfigured: !!process.env.WISE_API_TOKEN,
        profileIdConfigured: !!process.env.WISE_PROFILE_ID,
        privateKeyConfigured: !!process.env.WISE_PRIVATE_KEY,
        scaSignerConfigured: wiseScaSigner.isConfigured(),
        profileId: process.env.WISE_PROFILE_ID || 'NOT SET'
      };

      console.log('Wise configuration check:', config);

      const isConnected = await wiseService.testConnection();

      if (isConnected) {
        res.json({
          success: true,
          message: 'Wise API connection successful',
          config: config
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Wise API connection failed',
          config: config,
          hint: !config.privateKeyConfigured
            ? 'WISE_PRIVATE_KEY is not set in environment variables'
            : !config.apiTokenConfigured
            ? 'WISE_API_TOKEN is not set in environment variables'
            : !config.profileIdConfigured
            ? 'WISE_PROFILE_ID is not set in environment variables'
            : 'Check Railway logs for detailed error messages'
        });
      }
    } catch (error) {
      next(error);
    }
  }
};

module.exports = WiseWebhookController;
