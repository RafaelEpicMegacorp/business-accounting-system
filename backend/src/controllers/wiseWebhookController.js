const crypto = require('crypto');
const pool = require('../config/database');
const wiseService = require('../services/wiseService');

/**
 * Wise Webhook Controller
 * Handles incoming webhook events from Wise for real-time transaction sync
 */

class WiseWebhookController {
  /**
   * Verify Wise webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - X-Signature-SHA256 header
   * @param {string} secret - Webhook secret
   * @returns {boolean}
   */
  verifySignature(payload, signature, secret) {
    if (!secret) {
      console.warn('⚠️  No webhook secret configured, skipping signature verification');
      return true; // Allow for testing without secret
    }

    try {
      const hash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('❌ Signature verification error:', error.message);
      return false;
    }
  }

  /**
   * Handle incoming Wise webhook
   * POST /api/wise/webhook
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['x-signature-sha256'];
      const webhookSecret = process.env.WISE_WEBHOOK_SECRET;

      // Verify signature
      if (!this.verifySignature(JSON.stringify(req.body), signature, webhookSecret)) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.body;

      // Handle Wise webhook validation requests (empty or minimal payload)
      if (!event || !event.data || !event.event_type) {
        console.log('📥 Received webhook validation request');
        return res.status(200).json({ received: true });
      }

      console.log(`📥 Received webhook event: ${event.event_type} (${event.data.resource})`);

      // Store raw webhook event
      const eventId = event.data.resource_id || event.data.transfer_id || `evt_${Date.now()}`;

      await pool.query(
        `INSERT INTO wise_webhook_events
         (event_type, event_id, resource_type, resource_id, payload, received_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          event.event_type,
          eventId,
          event.data.resource,
          event.data.resource_id || event.data.transfer_id,
          JSON.stringify(event)
        ]
      );

      // Update sync status
      await pool.query(
        `UPDATE wise_sync_status
         SET last_webhook_received = CURRENT_TIMESTAMP,
             total_events_received = total_events_received + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE profile_id = $1`,
        [process.env.WISE_PROFILE_ID]
      );

      // Process webhook event asynchronously
      this.processWebhookEvent(eventId).catch(err => {
        console.error(`❌ Error processing webhook ${eventId}:`, err.message);
      });

      // Respond immediately (Wise expects quick response)
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ Webhook handler error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Process webhook event and create accounting entry
   * @param {string} eventId - Event ID to process
   */
  async processWebhookEvent(eventId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get unprocessed event
      const eventResult = await client.query(
        'SELECT * FROM wise_webhook_events WHERE event_id = $1 AND processed = false',
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        console.log(`ℹ️  Event ${eventId} already processed or not found`);
        return;
      }

      const event = eventResult.rows[0];
      const payload = event.payload;

      // Only process transaction-related events
      if (!['transfers#state-change', 'balances#credit', 'balances#debit'].includes(payload.event_type)) {
        await client.query(
          'UPDATE wise_webhook_events SET processed = true, processed_at = CURRENT_TIMESTAMP WHERE id = $1',
          [event.id]
        );
        await client.query('COMMIT');
        console.log(`ℹ️  Skipped non-transaction event: ${payload.event_type}`);
        return;
      }

      // Extract transaction data
      const transactionData = this.extractTransactionData(payload);

      if (!transactionData) {
        await client.query(
          `UPDATE wise_webhook_events
           SET processed = true, processed_at = CURRENT_TIMESTAMP,
               error_message = 'Could not extract transaction data'
           WHERE id = $1`,
          [event.id]
        );
        await client.query('COMMIT');
        return;
      }

      // Check for duplicate transaction
      const existingTx = await client.query(
        'SELECT id FROM wise_transactions WHERE wise_transaction_id = $1',
        [transactionData.transactionId]
      );

      if (existingTx.rows.length > 0) {
        console.log(`ℹ️  Transaction ${transactionData.transactionId} already exists, skipping`);
        await client.query(
          'UPDATE wise_webhook_events SET processed = true, processed_at = CURRENT_TIMESTAMP WHERE id = $1',
          [event.id]
        );
        await client.query('COMMIT');
        return;
      }

      // Auto-categorize transaction
      const category = await this.categorizeTransaction(transactionData);

      // Get exchange rate
      let exchangeRate = 1.0;
      if (transactionData.currency !== 'USD') {
        exchangeRate = await wiseService.getExchangeRate(transactionData.currency, 'USD');
      }

      const amountUSD = transactionData.amount * exchangeRate;

      // Create accounting entry
      const entryResult = await client.query(
        `INSERT INTO entries
         (type, category, description, detail, base_amount, total, entry_date, status,
          bank_account, original_currency, original_amount, exchange_rate,
          transaction_reference, wise_transaction_id, employee_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed',
                 $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
          transactionData.type,
          category.category,
          transactionData.description,
          transactionData.merchantName || 'Wise transaction',
          Math.abs(amountUSD),
          Math.abs(amountUSD),
          transactionData.date,
          transactionData.currency,
          transactionData.currency,
          Math.abs(transactionData.amount),
          exchangeRate,
          transactionData.reference,
          transactionData.transactionId,
          category.employeeId
        ]
      );

      const entryId = entryResult.rows[0].id;

      // Store Wise transaction mapping
      await client.query(
        `INSERT INTO wise_transactions
         (wise_transaction_id, wise_transfer_id, wise_balance_id, entry_id,
          transaction_type, amount, currency, status, merchant_name, description,
          transaction_date, raw_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          transactionData.transactionId,
          transactionData.transferId,
          transactionData.balanceId,
          entryId,
          transactionData.type,
          transactionData.amount,
          transactionData.currency,
          transactionData.status,
          transactionData.merchantName,
          transactionData.description,
          transactionData.date,
          JSON.stringify(payload.data)
        ]
      );

      // Mark webhook event as processed
      await client.query(
        `UPDATE wise_webhook_events
         SET processed = true, processed_at = CURRENT_TIMESTAMP, entry_id = $1
         WHERE id = $2`,
        [entryId, event.id]
      );

      // Update sync status
      await client.query(
        `UPDATE wise_sync_status
         SET total_events_processed = total_events_processed + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE profile_id = $1`,
        [process.env.WISE_PROFILE_ID]
      );

      await client.query('COMMIT');
      console.log(`✅ Created entry ${entryId} from webhook ${eventId}`);

    } catch (error) {
      await client.query('ROLLBACK');

      // Mark event as failed
      await client.query(
        `UPDATE wise_webhook_events
         SET error_message = $1, updated_at = CURRENT_TIMESTAMP
         WHERE event_id = $2`,
        [error.message, eventId]
      );

      // Update sync status
      await client.query(
        `UPDATE wise_sync_status
         SET total_events_failed = total_events_failed + 1,
             last_error = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE profile_id = $2`,
        [error.message, process.env.WISE_PROFILE_ID]
      );

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Extract transaction data from webhook payload
   * @param {Object} payload - Webhook payload
   * @returns {Object|null} Transaction data
   */
  extractTransactionData(payload) {
    try {
      const data = payload.data;
      const resource = data.resource;

      // Handle balance credit/debit events
      if (resource === 'balance' && data.transaction_type) {
        return {
          transactionId: data.transaction_id || `tx_${Date.now()}`,
          transferId: data.transfer_id || null,
          balanceId: data.balance_id,
          type: data.transaction_type === 'credit' ? 'income' : 'expense',
          amount: data.amount?.value || 0,
          currency: data.amount?.currency || data.currency,
          status: data.state || 'completed',
          merchantName: data.merchant?.name || data.details?.merchant || null,
          description: data.details?.description || data.details?.reference || 'Wise transaction',
          reference: data.details?.reference || null,
          date: data.occurred_at || data.created_at || new Date().toISOString()
        };
      }

      // Handle transfer state change events
      if (resource === 'transfer' && data.current_state === 'outgoing_payment_sent') {
        return {
          transactionId: `transfer_${data.resource_id}`,
          transferId: data.resource_id,
          balanceId: data.profile,
          type: 'expense',
          amount: data.target_value || data.source_value || 0,
          currency: data.target_currency || data.source_currency,
          status: data.current_state,
          merchantName: data.recipient_name || null,
          description: data.details?.reference || `Transfer to ${data.recipient_name}`,
          reference: data.details?.reference || null,
          date: data.occurred_at || new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error extracting transaction data:', error.message);
      return null;
    }
  }

  /**
   * Auto-categorize transaction based on merchant and description
   * @param {Object} transactionData - Transaction data
   * @returns {Object} { category, employeeId }
   */
  async categorizeTransaction(transactionData) {
    const description = (transactionData.description || '').toLowerCase();
    const merchant = (transactionData.merchantName || '').toLowerCase();
    const combined = `${description} ${merchant}`;

    // Income categorization
    if (transactionData.type === 'income') {
      if (combined.includes('zidan') || combined.includes('management group')) {
        return { category: 'Client Payment', employeeId: null };
      }
      return { category: 'Other Income', employeeId: null };
    }

    // Expense categorization

    // Employee payments
    const employeeKeywords = {
      'asif': 'Muhammad Asif',
      'muhammad asif': 'Muhammad Asif',
      'maryana': 'Maryana Budzovych',
      'budzovych': 'Maryana Budzovych',
      'abhijeet': 'Abhijeet Govindrao Rananaware',
      'rananaware': 'Abhijeet Govindrao Rananaware'
    };

    for (const [keyword, employeeName] of Object.entries(employeeKeywords)) {
      if (combined.includes(keyword)) {
        const employeeResult = await pool.query(
          'SELECT id FROM employees WHERE name = $1',
          [employeeName]
        );
        if (employeeResult.rows.length > 0) {
          return { category: 'Salary', employeeId: employeeResult.rows[0].id };
        }
      }
    }

    // Upwork payments
    if (combined.includes('upwork')) {
      return { category: 'Salary', employeeId: null }; // Recruiting costs
    }

    // Software subscriptions
    const softwareKeywords = ['notion', 'github', 'chatgpt', 'openai', 'aws', 'vercel', 'heroku', 'digital ocean', 'cloudflare'];
    if (softwareKeywords.some(kw => combined.includes(kw))) {
      return { category: 'Software', employeeId: null };
    }

    // Equipment
    const equipmentKeywords = ['laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'headphones', 'webcam'];
    if (equipmentKeywords.some(kw => combined.includes(kw))) {
      return { category: 'Equipment', employeeId: null };
    }

    // Office rent / Coworking
    const officeKeywords = ['coworking', 'wework', 'regus', 'office', 'workspace'];
    if (officeKeywords.some(kw => combined.includes(kw))) {
      return { category: 'Office Rent', employeeId: null };
    }

    // Business meals
    const mealKeywords = ['restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'food', 'uber eats', 'doordash'];
    if (mealKeywords.some(kw => combined.includes(kw))) {
      return { category: 'Business Meals', employeeId: null };
    }

    // Travel
    const travelKeywords = ['flight', 'hotel', 'airbnb', 'uber', 'lyft', 'taxi', 'rental car', 'booking.com'];
    if (travelKeywords.some(kw => combined.includes(kw))) {
      return { category: 'Travel', employeeId: null };
    }

    // Default
    return { category: 'Other Expense', employeeId: null };
  }

  /**
   * Get webhook sync status
   * GET /api/wise/status
   */
  async getStatus(req, res) {
    try {
      const statusResult = await pool.query(
        'SELECT * FROM wise_sync_status WHERE profile_id = $1',
        [process.env.WISE_PROFILE_ID]
      );

      if (statusResult.rows.length === 0) {
        return res.status(404).json({ error: 'Sync status not found' });
      }

      const status = statusResult.rows[0];

      // Get recent events
      const eventsResult = await pool.query(
        `SELECT event_type, event_id, processed, received_at, processed_at, error_message
         FROM wise_webhook_events
         ORDER BY received_at DESC
         LIMIT 10`
      );

      res.json({
        status: status,
        recentEvents: eventsResult.rows
      });
    } catch (error) {
      console.error('❌ Error fetching status:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all webhook events
   * GET /api/wise/events
   */
  async getEvents(req, res) {
    try {
      const { limit = 50, processed } = req.query;

      let query = 'SELECT * FROM wise_webhook_events';
      const params = [];

      if (processed !== undefined) {
        query += ' WHERE processed = $1';
        params.push(processed === 'true');
      }

      query += ' ORDER BY received_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Error fetching events:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Manually process pending webhook events
   * POST /api/wise/process-pending
   */
  async processPending(req, res) {
    try {
      const eventsResult = await pool.query(
        'SELECT event_id FROM wise_webhook_events WHERE processed = false ORDER BY received_at ASC'
      );

      const eventIds = eventsResult.rows.map(row => row.event_id);

      console.log(`🔄 Processing ${eventIds.length} pending webhook events...`);

      const results = [];
      for (const eventId of eventIds) {
        try {
          await this.processWebhookEvent(eventId);
          results.push({ eventId, success: true });
        } catch (error) {
          results.push({ eventId, success: false, error: error.message });
        }
      }

      res.json({
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      });
    } catch (error) {
      console.error('❌ Error processing pending events:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update webhook configuration
   * POST /api/wise/config
   */
  async updateConfig(req, res) {
    try {
      const { webhookEnabled, webhookUrl, webhookSecret } = req.body;

      await pool.query(
        `UPDATE wise_sync_status
         SET webhook_enabled = $1, webhook_url = $2, webhook_secret = $3, updated_at = CURRENT_TIMESTAMP
         WHERE profile_id = $4`,
        [webhookEnabled, webhookUrl, webhookSecret, process.env.WISE_PROFILE_ID]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Error updating config:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get balance summary
   * GET /api/wise/balances
   */
  async getBalances(req, res) {
    try {
      const balances = await wiseService.getBalances(process.env.WISE_PROFILE_ID);

      // Update sync status with current balances
      const balanceMap = {};
      balances.forEach(b => {
        balanceMap[`current_balance_${b.currency.toLowerCase()}`] = b.amount?.value || 0;
      });

      await pool.query(
        `UPDATE wise_sync_status
         SET current_balance_usd = $1,
             current_balance_eur = $2,
             current_balance_gbp = $3,
             current_balance_pln = $4,
             last_balance_sync = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE profile_id = $5`,
        [
          balanceMap.current_balance_usd || 0,
          balanceMap.current_balance_eur || 0,
          balanceMap.current_balance_gbp || 0,
          balanceMap.current_balance_pln || 0,
          process.env.WISE_PROFILE_ID
        ]
      );

      res.json(balances);
    } catch (error) {
      console.error('❌ Error fetching balances:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new WiseWebhookController();
