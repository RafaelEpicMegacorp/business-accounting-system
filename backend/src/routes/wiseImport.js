const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const WiseTransactionModel = require('../models/wiseTransactionModel');
const wiseTransactionProcessor = require('../services/wiseTransactionProcessor');
const { syncCompleteHistory } = require('./wiseSync_new');

// In-memory storage for recent webhooks (for monitoring dashboard)
const recentWebhooks = [];
const MAX_RECENT_WEBHOOKS = 50;

// Configure multer for CSV upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Category mapping for Wise CSV categories
const wiseCategoryMapping = {
  'Office expenses': 'Administration',
  'Contract services': 'Professional Services',
  'Software and web hosting': 'Software',
  'Marketing': 'Marketing',
  'Travel': 'Transportation',
  'General': 'Other Expenses',
  'Entertainment': 'Entertainment',
  'Rewards': 'Other Income',
  'Money added': 'Other Income',
  'Groceries': 'Groceries',
  'Restaurants': 'Restaurants',
  'Transportation': 'Transportation',
  'Utilities': 'Utilities',
  'Shopping': 'Shopping'
};

/**
 * Update currency balance from Wise API for a specific currency
 * @param {string} currency - Currency code (USD, EUR, PLN, GBP)
 */
async function updateCurrencyBalance(currency) {
  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';
  const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

  if (!WISE_API_TOKEN || !WISE_PROFILE_ID) {
    throw new Error('WISE_API_TOKEN or WISE_PROFILE_ID not configured');
  }

  const response = await fetch(
    `${WISE_API_URL}/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wise API error: ${response.status} ${errorText}`);
  }

  const balances = await response.json();

  // Update all balances (or just the specific currency if provided)
  for (const balance of balances) {
    if (!currency || balance.currency === currency) {
      await pool.query(`
        INSERT INTO currency_balances (currency, balance, last_updated)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (currency)
        DO UPDATE SET balance = $2, last_updated = CURRENT_TIMESTAMP
      `, [balance.currency, balance.amount.value]);

      console.log(`   ✓ Updated ${balance.currency} balance: ${balance.amount.value}`);
    }
  }
}

/**
 * Map Wise transfer state to entry status
 * @param {string} wiseState - Wise transfer state
 * @returns {string|null} Entry status ('pending' or 'completed') or null if no mapping (for cancelled/failed)
 */
function mapWiseStateToEntryStatus(wiseState) {
  const stateLower = (wiseState || '').toLowerCase();

  // Completed states
  if (stateLower.includes('completed') ||
      stateLower.includes('funds_received') ||
      stateLower === 'funds_converted') {
    return 'completed';
  }

  // Pending/Processing states
  if (stateLower.includes('processing') ||
      stateLower.includes('outgoing_payment_sent') ||
      stateLower.includes('incoming_payment_waiting') ||
      stateLower.includes('waiting')) {
    return 'pending';
  }

  // Failed/Cancelled states - return null to flag for review
  if (stateLower.includes('cancelled') ||
      stateLower.includes('bounced') ||
      stateLower.includes('charged_back') ||
      stateLower.includes('refunded')) {
    return null; // Will flag for manual review
  }

  // Default to completed for unknown states
  return 'completed';
}

/**
 * Extract complete recipient/sender details from transfer object
 * @param {object} transferDetails - Full transfer object from Wise API
 * @param {string} txnType - Transaction type ('DEBIT' or 'CREDIT')
 * @returns {object} Structured recipient details
 */
function extractRecipientDetails(transferDetails, txnType) {
  // For DEBIT (outgoing), get recipient details
  // For CREDIT (incoming), get sender details
  const party = txnType === 'DEBIT'
    ? (transferDetails.details?.recipient || {})
    : (transferDetails.details?.sender || {});

  return {
    name: party.name || transferDetails.targetName || transferDetails.sourceName || '',
    accountNumber: party.accountNumber || party.iban || party.accountHolderName || '',
    bankCode: party.bankCode || party.bic || party.sortCode || party.swiftCode || '',
    address: {
      city: party.address?.city || party.city || '',
      country: party.address?.country || party.country || '',
      postCode: party.address?.postCode || party.postCode || '',
      firstLine: party.address?.firstLine || ''
    },
    email: party.email || '',
    legalType: party.legalType || 'PERSON' // PERSON or BUSINESS
  };
}

/**
 * Map Wise CSV category to our classification category
 * @param {string} wiseCategory - Category from Wise CSV
 * @returns {string} Mapped category
 */
function mapWiseCategory(wiseCategory) {
  if (!wiseCategory) return null;
  return wiseCategoryMapping[wiseCategory] || null;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"' && inQuotes) {
      inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCurrency(value) {
  if (!value || value === '') return null;
  return parseFloat(value.replace(/,/g, ''));
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '') return null;
  const date = new Date(dateStr);
  return date.toISOString();
}

// Expected CSV header for Wise export
const EXPECTED_HEADERS = [
  'ID', 'Status', 'Direction', 'Created on', 'Finished on',
  'Source fee amount', 'Source fee currency', 'Target fee amount', 'Target fee currency',
  'Source name', 'Source amount', 'Source currency',
  'Target name', 'Target amount', 'Target currency',
  'Exchange rate', 'Reference', 'Batch', 'Created by', 'Category', 'Note'
];

// GET /api/wise/test-connection - Test database connection
router.get('/test-connection', auth, async (req, res) => {
  console.log('=== Testing Database Connection ===');
  try {
    // Test 1: Pool query (simple)
    console.log('Test 1: Testing pool.query()...');
    const queryResult = await pool.query('SELECT NOW() as time, current_database() as db');
    console.log('✓ pool.query() success:', queryResult.rows[0]);

    // Test 2: Get client (complex)
    console.log('Test 2: Testing pool.getClient()...');
    const client = await pool.getClient();
    console.log('✓ pool.getClient() success');

    try {
      const clientResult = await client.query('SELECT NOW() as time');
      console.log('✓ client.query() success:', clientResult.rows[0]);
    } finally {
      client.release();
      console.log('✓ client.release() success');
    }

    // Test 3: Pool stats
    console.log('Test 3: Checking pool stats...');
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
    console.log('Pool stats:', poolStats);

    res.json({
      success: true,
      message: 'Database connection test passed',
      tests: {
        poolQuery: 'PASSED',
        getClient: 'PASSED',
        clientQuery: 'PASSED'
      },
      poolStats,
      database: queryResult.rows[0].db,
      timestamp: queryResult.rows[0].time
    });
  } catch (error) {
    console.error('=== Database Connection Test Failed ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      errorCode: error.code,
      stack: error.stack
    });
  }
});

// GET /api/wise/webhooks/recent - Get recent webhook calls (memory + database)
router.get('/webhooks/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Get recent webhooks from database (all webhook-related actions for debugging)
    const dbWebhooks = await pool.query(`
      SELECT * FROM wise_sync_audit_log
      WHERE action LIKE 'webhook_%'
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    // Transform database records to extract event data from new_values JSONB
    const transformedDbWebhooks = dbWebhooks.rows.map(row => {
      const eventData = row.new_values || {};
      return {
        id: row.id,
        event_type: eventData.event_type || 'unknown',
        received_at: eventData.received_at || row.created_at,
        payload: eventData.payload || {},
        processing_status: eventData.processing_status || 'unknown',
        processing_result: eventData.processing_result,
        error: eventData.error,
        wise_transaction_id: row.wise_transaction_id,
        entry_id: row.entry_id,
        created_at: row.created_at,
        source: 'database'
      };
    });

    // Combine in-memory and database webhooks
    const allWebhooks = [
      ...recentWebhooks.map(w => ({ ...w, source: 'memory' })),
      ...transformedDbWebhooks
    ];

    // Sort by timestamp descending
    allWebhooks.sort((a, b) => {
      const timeA = new Date(a.received_at || a.created_at);
      const timeB = new Date(b.received_at || b.created_at);
      return timeB - timeA;
    });

    res.json({
      success: true,
      count: allWebhooks.length,
      webhooks: allWebhooks.slice(0, limit)
    });
  } catch (error) {
    console.error('Error fetching recent webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhooks',
      message: error.message
    });
  }
});

// GET /api/wise/webhooks/logs - Get webhook audit logs
router.get('/webhooks/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(`
      SELECT
        wal.*,
        wt.description as transaction_description,
        wt.amount as transaction_amount,
        wt.currency as transaction_currency,
        e.id as entry_id,
        e.description as entry_description
      FROM wise_sync_audit_log wal
      LEFT JOIN wise_transactions wt ON wal.wise_transaction_id = wt.wise_transaction_id
      LEFT JOIN entries e ON wal.entry_id = e.id
      ORDER BY wal.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM wise_sync_audit_log');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      total,
      limit,
      offset,
      logs: result.rows
    });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

// DELETE /api/wise/webhooks/clear-db - Clear all webhook logs from database
router.delete('/webhooks/clear-db', async (req, res) => {
  try {
    console.log('🗑️ Clearing webhook logs from database...');

    // Delete all webhook-related logs from audit table
    const result = await pool.query(`
      DELETE FROM wise_sync_audit_log
      WHERE action LIKE 'webhook_%'
    `);

    const deletedCount = result.rowCount;

    // Clear in-memory webhooks array
    recentWebhooks.length = 0;

    console.log(`✓ Deleted ${deletedCount} webhook logs from database`);

    res.json({
      success: true,
      message: `Cleared ${deletedCount} webhook logs from database`,
      deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing webhook logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear webhook logs',
      message: error.message
    });
  }
});

/**
 * GET /api/wise/webhooks/health
 * Get webhook health and statistics
 */
router.get('/webhooks/health', auth, async (req, res) => {
  try {
    console.log('[Webhook Health] Fetching webhook statistics...');

    // Get webhook statistics from audit log
    const statsQuery = `
      SELECT
        COUNT(*) as total_webhooks,
        COUNT(DISTINCT wise_transaction_id) as unique_transactions,
        COUNT(CASE WHEN action LIKE 'webhook_%' THEN 1 END) as webhook_events,
        COUNT(CASE WHEN action = 'webhook_balance_credit' THEN 1 END) as balance_credits,
        COUNT(CASE WHEN action = 'webhook_balance_update' THEN 1 END) as balance_updates,
        COUNT(CASE WHEN action = 'webhook_transfer_state_change' THEN 1 END) as transfer_state_changes,
        COUNT(CASE WHEN action = 'webhook_card_transaction' THEN 1 END) as card_transactions,
        COUNT(CASE WHEN action = 'webhook_transfer_issue' THEN 1 END) as transfer_issues,
        MAX(created_at) as last_webhook_received,
        MIN(created_at) as first_webhook_received
      FROM wise_sync_audit_log
      WHERE action LIKE 'webhook_%'
        AND created_at > NOW() - INTERVAL '30 days'
    `;

    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    // Get recent webhook processing status
    const recentQuery = `
      SELECT
        action,
        notes,
        created_at,
        wise_transaction_id
      FROM wise_sync_audit_log
      WHERE action LIKE 'webhook_%'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const recentResult = await pool.query(recentQuery);

    // Calculate days since last webhook
    const daysSinceLastWebhook = stats.last_webhook_received
      ? Math.floor((new Date() - new Date(stats.last_webhook_received)) / (1000 * 60 * 60 * 24))
      : null;

    // Determine health status
    let status = 'healthy';
    let statusMessage = 'Webhooks are being received and processed normally';

    if (!stats.last_webhook_received) {
      status = 'no_data';
      statusMessage = 'No webhook data found in the last 30 days';
    } else if (daysSinceLastWebhook > 7) {
      status = 'stale';
      statusMessage = `No webhooks received in ${daysSinceLastWebhook} days`;
    } else if (daysSinceLastWebhook > 1) {
      status = 'warning';
      statusMessage = `Last webhook received ${daysSinceLastWebhook} days ago`;
    }

    // Get webhook configuration
    const webhooksConfigured = [
      'transfers#state-change',
      'balances#credit',
      'balances#update',
      'card-transactions#created',
      'card-transactions#updated',
      'transfers#active-cases'
    ];

    console.log('[Webhook Health] Statistics retrieved:', {
      total_webhooks: stats.total_webhooks,
      status,
      days_since_last: daysSinceLastWebhook
    });

    res.json({
      success: true,
      data: {
        status,
        status_message: statusMessage,
        webhooks_configured: webhooksConfigured,
        statistics: {
          total_webhooks: parseInt(stats.total_webhooks) || 0,
          unique_transactions: parseInt(stats.unique_transactions) || 0,
          webhook_events: parseInt(stats.webhook_events) || 0,
          balance_credits: parseInt(stats.balance_credits) || 0,
          balance_updates: parseInt(stats.balance_updates) || 0,
          transfer_state_changes: parseInt(stats.transfer_state_changes) || 0,
          card_transactions: parseInt(stats.card_transactions) || 0,
          transfer_issues: parseInt(stats.transfer_issues) || 0,
          last_received: stats.last_webhook_received,
          first_received: stats.first_webhook_received,
          days_since_last_webhook: daysSinceLastWebhook
        },
        recent_webhooks: recentResult.rows,
        endpoint: `${process.env.API_BASE_URL || 'http://localhost:7393'}/api/wise/webhook`
      }
    });
  } catch (error) {
    console.error('[Webhook Health] Error getting webhook health:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to get webhook health'
    });
  }
});

// GET /api/wise/transactions/pending - Get transactions needing review
router.get('/transactions/pending', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        wt.*,
        e.name as employee_name,
        ent.id as entry_id,
        ent.description as entry_description
      FROM wise_transactions wt
      LEFT JOIN employees e ON wt.matched_employee_id = e.id
      LEFT JOIN entries ent ON wt.entry_id = ent.id
      WHERE wt.needs_review = true OR wt.sync_status = 'pending'
      ORDER BY wt.transaction_date DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      transactions: result.rows
    });
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

// POST /api/wise/import - Upload and import Wise CSV
router.post('/import', auth, upload.single('csvFile'), async (req, res) => {
  console.log('=== CSV Import Started (Enhanced with Shared Processor) ===');
  console.log('User:', req.user?.id, req.user?.username);
  console.log('File:', req.file?.originalname, req.file?.size, 'bytes');

  try {
    if (!req.file) {
      console.error('ERROR: No file uploaded');
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    // Parse file content
    let fileContent;
    try {
      fileContent = req.file.buffer.toString('utf-8');
      console.log('File content length:', fileContent.length, 'characters');
    } catch (err) {
      console.error('ERROR: Failed to read file buffer:', err.message);
      return res.status(400).json({
        error: 'Failed to read CSV file',
        details: 'File might be corrupted or in wrong encoding'
      });
    }

    const lines = fileContent.split('\n').filter(line => line.trim());
    console.log('Total lines (including header):', lines.length);

    if (lines.length < 2) {
      console.error('ERROR: CSV file too short');
      return res.status(400).json({
        error: 'CSV file is empty or invalid',
        details: 'File must contain at least a header row and one data row'
      });
    }

    // Validate CSV header
    const headerLine = lines[0];
    const headerFields = parseCSVLine(headerLine);
    console.log('CSV Headers found:', headerFields.length, 'columns');
    console.log('First 5 headers:', headerFields.slice(0, 5).join(', '));

    if (headerFields.length !== 21) {
      console.error('ERROR: Wrong number of columns. Expected 21, got', headerFields.length);
      return res.status(400).json({
        error: 'Invalid CSV format',
        details: `CSV must have 21 columns (Wise export format). Found ${headerFields.length} columns. Please export from Wise: Account → Statements → Export → CSV`
      });
    }

    // Verify key columns exist
    const headerLower = headerFields.map(h => h.trim().toLowerCase());
    const hasID = headerLower.includes('id');
    const hasStatus = headerLower.includes('status');
    const hasDirection = headerLower.includes('direction');

    if (!hasID || !hasStatus || !hasDirection) {
      console.error('ERROR: Missing required columns:', { hasID, hasStatus, hasDirection });
      return res.status(400).json({
        error: 'Invalid CSV format',
        details: 'CSV is missing required columns (ID, Status, Direction). Please export from Wise: Account → Statements → Export → CSV'
      });
    }

    console.log('✓ CSV header validation passed');

    // Parse CSV rows into transaction data
    const transactions = [];
    const parseErrors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]);

        // Validate row has correct number of fields
        if (fields.length !== 21) {
          parseErrors.push({ line: i + 1, error: `Expected 21 fields, found ${fields.length}` });
          continue;
        }

        const [
          id, status, direction, createdOn, finishedOn,
          sourceFeeAmount, sourceFeeCurrency, targetFeeAmount, targetFeeCurrency,
          sourceName, sourceAmount, sourceCurrency,
          targetName, targetAmount, targetCurrency,
          exchangeRate, reference, batch, createdBy, wiseCategory, note
        ] = fields;

        // Validate required fields
        if (!id || !id.trim()) {
          parseErrors.push({ line: i + 1, error: 'Missing transaction ID' });
          continue;
        }

        // Skip cancelled/refunded transactions
        if (status === 'CANCELLED' || status === 'REFUNDED') {
          continue;
        }

        // Determine amount and currency based on direction
        let amount, currency;
        if (direction === 'OUT') {
          amount = parseCurrency(sourceAmount);
          currency = sourceCurrency;
        } else {
          amount = parseCurrency(targetAmount);
          currency = targetCurrency;
        }

        // Skip zero amount transactions
        if (!amount || amount === 0) {
          continue;
        }

        // Determine transaction type
        const txnType = direction === 'OUT' ? 'DEBIT' : 'CREDIT';

        // Prepare transaction data for processor
        const txnData = {
          wise_transaction_id: `CSV-IMPORT-${id}`,
          wise_resource_id: id,
          profile_id: process.env.WISE_PROFILE_ID || 'unknown',
          account_id: null,
          type: txnType,
          state: status,
          amount: Math.abs(amount),
          currency: currency,
          description: targetName || sourceName || 'Wise Transaction',
          merchant_name: targetName || sourceName || null,
          reference_number: reference || null,
          transaction_date: parseDate(finishedOn) || parseDate(createdOn),
          value_date: parseDate(finishedOn) || null,
          classified_category: mapWiseCategory(wiseCategory),
          raw_payload: {
            csvRow: i + 1,
            id, status, direction, createdOn, finishedOn,
            sourceFeeAmount, sourceFeeCurrency, targetFeeAmount, targetFeeCurrency,
            sourceName, sourceAmount, sourceCurrency,
            targetName, targetAmount, targetCurrency,
            exchangeRate, reference, batch, createdBy, wiseCategory, note
          }
        };

        transactions.push(txnData);

      } catch (rowErr) {
        parseErrors.push({ line: i + 1, error: rowErr.message });
        console.error(`Error parsing row ${i + 1}:`, rowErr.message);
      }
    }

    console.log(`✓ Parsed ${transactions.length} valid transactions (${parseErrors.length} parse errors)`);

    // Process transactions using shared processor
    console.log('Processing transactions with shared processor...');
    const processingStats = await wiseTransactionProcessor.processBatch(transactions, 'csv');

    // Prepare response
    const response = {
      success: true,
      message: `CSV import complete`,
      summary: {
        totalRows: lines.length - 1,
        parsed: transactions.length,
        parseErrors: parseErrors.length,
        imported: processingStats.imported,
        updated: processingStats.updated,
        skipped: processingStats.skipped,
        processingErrors: processingStats.errors,
        entriesCreated: processingStats.entriesCreated,
        durationMs: processingStats.durationMs
      },
      details: {
        parseErrors: parseErrors.length > 0 ? parseErrors.slice(0, 10) : [],
        processingErrors: processingStats.errorDetails.length > 0 ? processingStats.errorDetails.slice(0, 10) : []
      }
    };

    console.log('=== Import Complete ===');
    console.log('Summary:', JSON.stringify(response.summary));
    res.json(response);

  } catch (error) {
    console.error('=== Import Failed ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    res.status(500).json({
      error: 'Failed to import CSV',
      details: error.message
    });
  }
});

// POST /api/wise/webhook - Receive Wise webhook events
// Note: No signature validation required per Wise personal account setup
// Just log and process all incoming webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const startTime = Date.now();
  const receivedAt = new Date();

  // Log incoming webhook
  console.log('\n🔔 Wise Webhook Received:', receivedAt.toISOString());
  console.log('   Delivery ID:', req.headers['x-delivery-id'] || 'none');
  console.log('   Test:', req.headers['x-test-notification'] === 'true' ? 'YES' : 'NO');

  // CHECK TEST NOTIFICATION FIRST - before ANY body parsing
  // Wise sends X-Test-Notification: true during URL validation
  if (req.headers['x-test-notification'] === 'true') {
    console.log('✅ X-Test-Notification header detected - This is URL validation');

    // Log test notifications to database for monitoring
    try {
      const rawBody = req.body.toString('utf8');
      const event = JSON.parse(rawBody);

      await pool.query(
        `INSERT INTO wise_sync_audit_log (action, notes, new_values)
         VALUES ($1, $2, $3)`,
        [
          'webhook_test',
          'Test notification from Wise (URL validation)',
          JSON.stringify({
            event_type: event.event_type || 'test',
            received_at: receivedAt.toISOString(),
            payload: event,
            headers: {
              deliveryId: req.headers['x-delivery-id'],
              testNotification: req.headers['x-test-notification']
            },
            processing_status: 'test'
          })
        ]
      );
      console.log('✓ Test notification logged to database');
    } catch (error) {
      console.warn('Failed to log test notification:', error.message);
    }

    console.log('Responding with 200 OK for validation');
    return res.status(200).json({
      success: true,
      message: 'Webhook endpoint validated successfully',
      timestamp: new Date().toISOString()
    });
  }

  console.log('📝 Not a test notification - proceeding with normal webhook processing');
  console.log('Timestamp:', receivedAt.toISOString());

  // Capture raw body and parse it manually
  const rawBody = req.body.toString('utf8');
  let event;

  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    console.error('Failed to parse webhook body as JSON:', error.message);

    // Empty body = validation request, accept it
    if (!rawBody || rawBody.trim() === '') {
      console.log('✓ Empty body validation request');
      return res.status(200).json({
        status: 'ok',
        message: 'Webhook endpoint is ready'
      });
    }

    // Non-empty but invalid JSON = error
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Webhook body is not valid JSON'
    });
  }

  // Validate event_type exists
  if (!event.event_type) {
    // Minimal body = validation request
    if (rawBody === '{}' || Object.keys(event).length === 0) {
      console.log('   ✓ Minimal body validation request');
      return res.status(200).json({ status: 'ok' });
    }

    // Has body but no event_type = error
    console.error('   ✗ Webhook missing event_type');
    return res.status(400).json({
      error: 'Missing event_type',
      message: 'Webhook body must include event_type field'
    });
  }

  // Log event details
  console.log('   Event Type:', event.event_type);
  console.log('   Event Data:', event.data ? 'present' : 'none');

  // Create webhook tracking object
  const webhookData = {
    received_at: receivedAt,
    event_type: event.event_type,
    payload: event,
    headers: {
      testNotification: req.headers['x-test-notification'],
      deliveryId: req.headers['x-delivery-id'],
      contentType: req.headers['content-type']
    },
    processing_status: 'received',
    processing_result: null,
    error: null
  };

  try {
    // Process webhook (no signature validation required)
    console.log('   ✓ Webhook accepted - processing...');
    webhookData.processing_status = 'processing';

    // Handle test events
    if (event.event_type === 'test' || event.event_type === 'webhook#test') {
      console.log('✓ Test webhook received successfully');

      const elapsed = Date.now() - startTime;
      webhookData.processing_status = 'success';
      webhookData.processing_result = 'Test webhook acknowledged';
      webhookData.processing_time_ms = elapsed;

      // Add to in-memory array
      recentWebhooks.unshift(webhookData);
      if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
        recentWebhooks.pop();
      }

      // Log to database
      await pool.query(
        `INSERT INTO wise_sync_audit_log (action, notes, new_values)
         VALUES ($1, $2, $3)`,
        [
          'webhook_test_received',
          'Test webhook received and acknowledged',
          JSON.stringify(webhookData)
        ]
      );

      return res.status(200).json({
        success: true,
        message: 'Test webhook received',
        processing_time_ms: elapsed
      });
    }

    // Handle balance credit events (incoming money)
    if (event.event_type === 'balances#credit' || event.event_type === 'balance-transactions#credit') {
      console.log('Processing balance credit event...');

      try {
        const result = await processBalanceTransaction(event.data, 'CREDIT');

        const elapsed = Date.now() - startTime;
        console.log(`✓ Balance credit processed in ${elapsed}ms`);

        webhookData.processing_status = 'success';
        webhookData.processing_result = result;
        webhookData.processing_time_ms = elapsed;

        // Add to in-memory array
        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }

        // Log to database
        await pool.query(
          `INSERT INTO wise_sync_audit_log (wise_transaction_id, action, notes, new_values)
           VALUES ($1, $2, $3, $4)`,
          [
            result?.transactionId || null,
            'webhook_balance_credit',
            `Balance credit processed: ${result?.message || 'Transaction created'}`,
            JSON.stringify({ webhook: webhookData, result })
          ]
        );

        return res.status(200).json({
          success: true,
          message: 'Balance credit processed',
          processing_time_ms: elapsed,
          result
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        webhookData.processing_status = 'failed';
        webhookData.error = error.message;
        webhookData.processing_time_ms = elapsed;

        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }

        throw error;
      }
    }

    // Handle balance update events
    if (event.event_type === 'balances#update' || event.event_type === 'balance-transactions#update') {
      console.log('Processing balance update event...');

      try {
        const result = await processBalanceTransaction(event.data, 'UPDATE');

        const elapsed = Date.now() - startTime;
        console.log(`✓ Balance update processed in ${elapsed}ms`);

        webhookData.processing_status = 'success';
        webhookData.processing_result = result;
        webhookData.processing_time_ms = elapsed;

        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }

        await pool.query(
          `INSERT INTO wise_sync_audit_log (wise_transaction_id, action, notes, new_values)
           VALUES ($1, $2, $3, $4)`,
          [
            result?.transactionId || null,
            'webhook_balance_update',
            `Balance update processed: ${result?.message || 'Transaction updated'}`,
            JSON.stringify({ webhook: webhookData, result })
          ]
        );

        return res.status(200).json({
          success: true,
          message: 'Balance update processed',
          processing_time_ms: elapsed,
          result
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        webhookData.processing_status = 'failed';
        webhookData.error = error.message;
        webhookData.processing_time_ms = elapsed;
        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }
        throw error;
      }
    }

    // Handle transfer state changes
    if (event.event_type === 'transfers#state-change') {
      console.log('Processing transfer state change...');

      try {
        const result = await processTransferStateChange(event.data);

        const elapsed = Date.now() - startTime;
        console.log(`✓ Transfer state change processed in ${elapsed}ms`);

        webhookData.processing_status = 'success';
        webhookData.processing_result = result;
        webhookData.processing_time_ms = elapsed;

        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }

        await pool.query(
          `INSERT INTO wise_sync_audit_log (wise_transaction_id, action, notes, new_values)
           VALUES ($1, $2, $3, $4)`,
          [
            event.data.resource?.id || event.data.transfer_id || null,
            'webhook_transfer_state_change',
            `Transfer state changed to: ${event.data.current_state || 'unknown'}`,
            JSON.stringify({ webhook: webhookData, result })
          ]
        );

        return res.status(200).json({
          success: true,
          message: 'Transfer state change processed',
          processing_time_ms: elapsed,
          result
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        webhookData.processing_status = 'failed';
        webhookData.error = error.message;
        webhookData.processing_time_ms = elapsed;
        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }
        throw error;
      }
    }

    // Handle transfer issues/active cases
    if (event.event_type === 'transfers#active-cases') {
      console.log('Processing transfer active case (issue)...');

      try {
        const result = await processTransferIssue(event.data);

        const elapsed = Date.now() - startTime;
        console.log(`✓ Transfer issue processed in ${elapsed}ms`);

        webhookData.processing_status = 'success';
        webhookData.processing_result = result;
        webhookData.processing_time_ms = elapsed;

        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }

        await pool.query(
          `INSERT INTO wise_sync_audit_log (wise_transaction_id, action, notes, new_values)
           VALUES ($1, $2, $3, $4)`,
          [
            event.data.resource?.id || event.data.transfer_id || null,
            'webhook_transfer_issue',
            `Transfer issue detected: ${event.data.case_type || 'unknown'}`,
            JSON.stringify({ webhook: webhookData, result })
          ]
        );

        return res.status(200).json({
          success: true,
          message: 'Transfer issue logged',
          processing_time_ms: elapsed,
          result
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        webhookData.processing_status = 'failed';
        webhookData.error = error.message;
        webhookData.processing_time_ms = elapsed;
        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }
        throw error;
      }
    }

    // Handle card transaction events (new)
    if (event.event_type === 'card-transactions#created' || event.event_type === 'card-transactions#updated') {
      console.log('Processing card transaction event...');

      try {
        const result = await processCardTransaction(event.data);

        const elapsed = Date.now() - startTime;
        console.log(`✓ Card transaction processed in ${elapsed}ms`);

        webhookData.processing_status = 'success';
        webhookData.processing_result = result;
        webhookData.processing_time_ms = elapsed;

        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }

        await pool.query(
          `INSERT INTO wise_sync_audit_log (wise_transaction_id, action, notes, new_values)
           VALUES ($1, $2, $3, $4)`,
          [
            result?.transactionId || null,
            'webhook_card_transaction',
            `Card transaction processed: ${result?.message || 'Transaction created'}`,
            JSON.stringify({ webhook: webhookData, result })
          ]
        );

        return res.status(200).json({
          success: true,
          message: 'Card transaction processed',
          processing_time_ms: elapsed,
          result
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        webhookData.processing_status = 'failed';
        webhookData.error = error.message;
        webhookData.processing_time_ms = elapsed;
        recentWebhooks.unshift(webhookData);
        if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
          recentWebhooks.pop();
        }
        throw error;
      }
    }

    // Unknown event type
    console.warn('Unknown event type:', event.event_type);

    const elapsed = Date.now() - startTime;
    webhookData.processing_status = 'skipped';
    webhookData.processing_result = 'Unknown event type, not processed';
    webhookData.processing_time_ms = elapsed;

    recentWebhooks.unshift(webhookData);
    if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
      recentWebhooks.pop();
    }

    await pool.query(
      `INSERT INTO wise_sync_audit_log (wise_transaction_id, action, notes, new_values)
       VALUES ($1, $2, $3, $4)`,
      [
        `WEBHOOK-UNKNOWN-${Date.now()}`,  // Placeholder ID for unknown events
        'webhook_unknown_event',
        `Unknown event type received: ${event.event_type}`,
        JSON.stringify(webhookData)
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Event received but not processed',
      event_type: event.event_type
    });

  } catch (error) {
    console.error('=== Webhook Processing Error ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    const elapsed = Date.now() - startTime;
    webhookData.processing_status = 'failed';
    webhookData.error = error.message;
    webhookData.error_stack = error.stack;
    webhookData.processing_time_ms = elapsed;

    // Add to in-memory array
    recentWebhooks.unshift(webhookData);
    if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
      recentWebhooks.pop();
    }

    // Log error to database
    try {
      await pool.query(
        `INSERT INTO wise_sync_audit_log (action, notes, new_values)
         VALUES ($1, $2, $3)`,
        [
          'webhook_processing_error',
          `Webhook processing failed: ${error.message}`,
          JSON.stringify(webhookData)
        ]
      );
    } catch (logError) {
      console.error('Failed to log webhook error to database:', logError);
    }

    // Still return 200 to Wise to avoid retries for processing errors
    return res.status(200).json({
      success: false,
      error: 'Internal processing error',
      message: error.message,
      processing_time_ms: elapsed
    });
  }
});

// Process balance transaction from webhook
async function processBalanceTransaction(data, direction) {
  try {
    console.log('[Webhook] Processing balance transaction...');

    // Extract resource ID and timestamp from webhook
    const balanceId = data.resource?.id;
    const occurredAt = data.occurred_at;
    const profileId = data.profile_id || process.env.WISE_PROFILE_ID;

    if (!balanceId || !occurredAt) {
      throw new Error('Webhook missing required fields: resource.id or occurred_at');
    }

    console.log('[Webhook] Balance event details:', {
      balance_id: balanceId,
      occurred_at: occurredAt,
      profile_id: profileId,
      direction
    });

    // Call Wise Balance Statement API to get full transaction details
    const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
    const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';

    if (!WISE_API_TOKEN) {
      throw new Error('WISE_API_TOKEN environment variable not set');
    }

    // Calculate time window around the event (±1 hour to ensure we catch it)
    const eventTime = new Date(occurredAt);
    const intervalStart = new Date(eventTime.getTime() - 3600000).toISOString(); // 1 hour before
    const intervalEnd = new Date(eventTime.getTime() + 3600000).toISOString();   // 1 hour after

    // Get the currency from the balance (we'll need to query balances first to know currency)
    // For now, we'll try common currencies if not specified
    const currency = data.currency || 'EUR'; // Default to EUR, can be improved

    const statementUrl = `${WISE_API_URL}/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json?currency=${currency}&intervalStart=${intervalStart}&intervalEnd=${intervalEnd}&type=COMPACT`;

    console.log('[Webhook] Fetching transaction from Wise API...');

    const response = await fetch(statementUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Webhook] Wise API Error:', response.status, errorText);
      throw new Error(`Wise API returned ${response.status}: ${errorText}`);
    }

    const statement = await response.json();
    console.log(`[Webhook] Received statement with ${statement.transactions?.length || 0} transactions`);

    // Find the transaction that matches our event time
    const transactions = statement.transactions || [];
    const matchingTransaction = transactions.find(txn => {
      const txnTime = new Date(txn.date);
      const timeDiff = Math.abs(txnTime.getTime() - eventTime.getTime());
      return timeDiff < 60000; // Within 1 minute of event time
    });

    if (!matchingTransaction) {
      console.log('[Webhook] No matching transaction found in statement');
      return {
        action: 'not_found',
        message: 'Transaction not found in statement',
        balanceId,
        occurredAt
      };
    }

    console.log('[Webhook] Found matching transaction:', matchingTransaction.referenceNumber);

    // Map transaction to normalized format for shared processor
    const txnData = {
      wise_transaction_id: matchingTransaction.referenceNumber,
      wise_resource_id: balanceId,
      profile_id: profileId,
      account_id: balanceId,
      type: matchingTransaction.type, // CREDIT or DEBIT from API
      state: 'COMPLETED',
      amount: Math.abs(parseFloat(matchingTransaction.amount.value)),
      currency: matchingTransaction.amount.currency,
      description: matchingTransaction.details?.description || 'Wise Balance Transaction',
      merchant_name: matchingTransaction.details?.senderName || matchingTransaction.details?.recipientName || null,
      reference_number: matchingTransaction.referenceNumber,
      transaction_date: matchingTransaction.date,
      value_date: matchingTransaction.date,
      raw_payload: matchingTransaction
    };

    // Process with shared processor
    const result = await wiseTransactionProcessor.processTransaction(txnData, 'webhook');

    console.log('[Webhook] Balance transaction processed:', {
      transaction_id: txnData.wise_transaction_id,
      action: result.action,
      entry_created: result.entryCreated,
      amount: txnData.amount,
      currency: txnData.currency
    });

    return {
      transactionId: txnData.wise_transaction_id,
      action: result.action,
      message: result.entryCreated ? 'Transaction imported and entry created' : 'Transaction processed',
      entryCreated: result.entryCreated,
      entryId: result.entryId,
      confidence: result.confidence,
      amount: txnData.amount,
      currency: txnData.currency
    };

  } catch (error) {
    console.error('[Webhook] Error processing balance transaction:', error);
    throw error;
  }
}

// Process transfer state change from webhook
async function processTransferStateChange(data) {
  try {
    console.log('[Webhook] Processing transfer state change...');

    const transferId = data.resource?.id || data.transfer_id || data.id;
    const currentState = data.current_state || data.state;
    const profileId = data.profile_id || process.env.WISE_PROFILE_ID;

    console.log('[Webhook] Transfer event details:', {
      transfer_id: transferId,
      current_state: currentState,
      previous_state: data.previous_state,
      profile_id: profileId
    });

    // Check if we have this transaction
    const existing = await WiseTransactionModel.getByWiseId(transferId);

    if (existing) {
      // Transaction exists - fetch full details from Wise API and reprocess
      console.log('[Webhook] Transfer found in database, fetching updated details...');

      const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
      const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';

      if (!WISE_API_TOKEN) {
        throw new Error('WISE_API_TOKEN environment variable not set');
      }

      // Fetch transfer details from Wise API
      const transferUrl = `${WISE_API_URL}/v1/transfers/${transferId}`;
      const response = await fetch(transferUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Webhook] Wise API Error:', response.status, errorText);
        throw new Error(`Wise API returned ${response.status}: ${errorText}`);
      }

      const transferDetails = await response.json();

      // Extract enhanced details
      const txnType = transferDetails.sourceValue ? 'DEBIT' : 'CREDIT';
      const recipientDetails = extractRecipientDetails(transferDetails, txnType);
      const transferFee = parseFloat(transferDetails.fee || 0);
      const exchangeRate = transferDetails.rate ? parseFloat(transferDetails.rate) : null;

      // Update wise_transactions with new state and enhanced details
      await pool.query(
        `UPDATE wise_transactions
         SET state = $1,
             raw_payload = $2,
             recipient_details = $3,
             transfer_fee = $4,
             transfer_exchange_rate = $5
         WHERE wise_resource_id = $6`,
        [
          currentState,
          transferDetails,
          recipientDetails,
          transferFee,
          exchangeRate,
          transferId
        ]
      );

      console.log(`[Webhook] Updated transaction state: ${existing.state} → ${currentState}`);
      console.log(`[Webhook] Recipient: ${recipientDetails.name} (${recipientDetails.accountNumber})`);
      if (transferFee > 0) console.log(`[Webhook] Fee: ${transferFee}`);
      if (exchangeRate) console.log(`[Webhook] Exchange rate: ${exchangeRate}`);

      // Map state to entry status and update if needed
      if (existing.entry_id) {
        const entryStatus = mapWiseStateToEntryStatus(currentState);

        if (entryStatus === null) {
          // Cancelled/Failed/Refunded - flag for review
          await pool.query(
            `UPDATE entries
             SET needs_review = true,
                 detail = COALESCE(detail, '') || ' [TRANSFER ' || UPPER($1) || ']'
             WHERE id = $2`,
            [currentState, existing.entry_id]
          );
          console.log(`[Webhook] ⚠️ Entry ${existing.entry_id} flagged for review (state: ${currentState})`);
        } else {
          // Update entry status
          await pool.query(
            `UPDATE entries SET status = $1 WHERE id = $2`,
            [entryStatus, existing.entry_id]
          );
          console.log(`[Webhook] Entry ${existing.entry_id} status updated to: ${entryStatus}`);
        }
      }

      // Create audit log for state change
      await WiseTransactionModel.createAuditLog({
        wiseTransactionId: existing.wise_transaction_id,
        entryId: existing.entry_id,
        action: 'state_change_webhook',
        notes: `Transfer state changed from ${existing.state} to ${currentState}`,
        oldValues: { state: existing.state },
        newValues: {
          state: currentState,
          recipient: recipientDetails.name,
          fee: transferFee,
          rate: exchangeRate
        }
      });

      console.log('[Webhook] Transfer state change processed:', {
        transfer_id: transferId,
        previous_state: existing.state,
        current_state: currentState,
        action: 'state_updated'
      });

      return {
        transferId,
        action: 'state_updated',
        message: `Transfer state updated to ${currentState}`,
        previousState: existing.state,
        currentState,
        entryUpdated: true,
        entryId: existing.entry_id
      };
    } else {
      console.log('[Webhook] Transfer not found in database - fetching immediately from Wise API...');

      // IMMEDIATE SYNC: Fetch the transfer from Wise API now instead of waiting for cron
      const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
      const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';

      if (!WISE_API_TOKEN) {
        console.error('[Webhook] WISE_API_TOKEN not set - cannot fetch transfer immediately');
        return {
          transferId,
          action: 'not_found',
          message: 'Transfer not found in database - will be synced later (API token missing)',
          currentState
        };
      }

      try {
        // Fetch transfer details from Wise API
        console.log(`[Webhook] Fetching transfer ${transferId} from Wise API...`);
        const transferUrl = `${WISE_API_URL}/v1/transfers/${transferId}`;
        const response = await fetch(transferUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${WISE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Webhook] Wise API Error:', response.status, errorText);
          throw new Error(`Wise API returned ${response.status}: ${errorText}`);
        }

        const transferDetails = await response.json();
        console.log('[Webhook] Transfer fetched successfully:', transferDetails.id);

        // Determine transaction type
        const txnType = transferDetails.sourceValue ? 'DEBIT' : 'CREDIT';
        const amount = Math.abs(parseFloat(transferDetails.sourceValue || transferDetails.targetValue));
        const currency = transferDetails.sourceCurrency || transferDetails.targetCurrency;
        const description = transferDetails.details?.reference || 'Wire Transfer';
        const transactionId = transferDetails.customerTransactionId || `TRANSFER-${transferDetails.id}`;
        const transactionDate = transferDetails.created;

        // Extract complete recipient details
        const recipientDetails = extractRecipientDetails(transferDetails, txnType);
        const transferFee = parseFloat(transferDetails.fee || 0);
        const exchangeRate = transferDetails.rate ? parseFloat(transferDetails.rate) : null;

        console.log(`[Webhook] Creating new transaction: ${txnType} ${amount} ${currency}`);
        console.log(`[Webhook] Recipient: ${recipientDetails.name}`);
        console.log(`[Webhook] Account: ${recipientDetails.accountNumber}`);
        if (transferFee > 0) console.log(`[Webhook] Fee: ${transferFee}`);
        if (exchangeRate) console.log(`[Webhook] Exchange rate: ${exchangeRate}`);

        // Check for duplicates by customerTransactionId
        const duplicateCheck = await WiseTransactionModel.exists(transactionId);
        if (duplicateCheck) {
          console.log('[Webhook] Transaction already exists (found by customerTransactionId)');
          return {
            transferId,
            action: 'duplicate',
            message: 'Transaction already exists',
            currentState
          };
        }

        // Store in wise_transactions table with enhanced details
        await WiseTransactionModel.create({
          wiseTransactionId: transactionId,
          wiseResourceId: transferId.toString(),
          profileId: profileId,
          accountId: transferDetails.sourceAccount || transferDetails.targetAccount,
          type: txnType,
          state: currentState,
          amount,
          currency,
          description,
          merchantName: recipientDetails.name,
          referenceNumber: transferDetails.reference || transactionId,
          transactionDate,
          valueDate: transactionDate,
          syncStatus: 'processed',
          classifiedCategory: null,
          matchedEmployeeId: null,
          confidenceScore: null,
          needsReview: false,
          rawPayload: transferDetails,
          transferFee: transferFee,
          transferExchangeRate: exchangeRate,
          recipientDetails: recipientDetails
        });

        console.log('[Webhook] Transaction stored in database');

        // Create entry immediately
        const entryType = txnType === 'CREDIT' ? 'income' : 'expense';
        const category = entryType === 'income' ? 'other_income' : 'other_expenses';

        const entryResult = await pool.query(
          `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            entryType,
            category,
            description || 'Wise transaction',
            `Imported from Wise via webhook (Ref: ${transactionId})`,
            amount,
            amount,
            transactionDate.split('T')[0],
            'completed',
            currency,
            amount,
            transactionId
          ]
        );

        // Link entry to transaction
        await WiseTransactionModel.updateStatus(transactionId, {
          entryId: entryResult.rows[0].id,
          syncStatus: 'processed'
        });

        console.log(`[Webhook] Entry created (ID: ${entryResult.rows[0].id})`);

        // Update currency balance for this currency
        console.log(`[Webhook] Updating ${currency} balance from Wise...`);
        try {
          await updateCurrencyBalance(currency);
          console.log(`[Webhook] ✓ ${currency} balance updated`);
        } catch (balanceError) {
          console.error(`[Webhook] ⚠️  Failed to update ${currency} balance:`, balanceError.message);
          // Don't fail the webhook if balance update fails
        }

        console.log(`[Webhook] ✅ Transfer ${transferId} fully imported via webhook-triggered immediate sync`);

        return {
          transferId,
          action: 'immediate_sync',
          message: `Transfer fetched and imported immediately via webhook`,
          currentState,
          transactionId,
          entryId: entryResult.rows[0].id,
          amount,
          currency,
          type: txnType
        };

      } catch (fetchError) {
        console.error('[Webhook] Failed to fetch transfer immediately:', fetchError.message);
        // Fallback: Return not_found so it gets synced in next cron run
        return {
          transferId,
          action: 'fetch_failed',
          message: `Failed to fetch transfer immediately - will be synced later: ${fetchError.message}`,
          currentState,
          error: fetchError.message
        };
      }
    }

  } catch (error) {
    console.error('[Webhook] Error processing transfer state change:', error);
    throw error;
  }
}

// Process transfer issue/active case from webhook
async function processTransferIssue(data) {
  try {
    const transferId = data.resource?.id || data.transfer_id || data.id;
    const issueType = data.case_type || 'unknown';
    const issueDetails = data.details || data.message || 'No details provided';

    console.log(`Transfer ${transferId} has issue: ${issueType}`);
    console.log(`Issue details: ${JSON.stringify(issueDetails)}`);

    // Check if we have this transaction
    const existing = await WiseTransactionModel.getByWiseId(transferId);

    if (existing) {
      // Update transaction with issue details
      await WiseTransactionModel.updateStatus(transferId, {
        syncStatus: 'failed',
        processingError: `Transfer issue: ${issueType} - ${JSON.stringify(issueDetails)}`,
        needsReview: true
      });

      console.log(`✓ Updated transaction ${transferId} with issue details`);
      console.warn(`⚠️ Transfer ${transferId} requires attention: ${issueType}`);

      // Create audit log entry for the issue
      await WiseTransactionModel.createAuditLog({
        wiseTransactionId: transferId,
        action: 'transfer_issue',
        notes: `Transfer issue detected: ${issueType}`,
        newValues: { issue_type: issueType, issue_details: issueDetails }
      });

    } else {
      console.log(`Transaction ${transferId} not found in database - storing issue for future reference`);

      // Store the issue even if we don't have the transaction yet
      // It might arrive later via balance update
      await pool.query(
        `INSERT INTO wise_sync_audit_log (wise_transaction_id, action, notes, new_values)
         VALUES ($1, $2, $3, $4)`,
        [
          transferId,
          'transfer_issue_early',
          `Issue detected before transaction sync: ${issueType}`,
          JSON.stringify({ issue_type: issueType, issue_details: issueDetails })
        ]
      );

      return {
        transferId,
        action: 'issue_logged',
        message: `Transfer issue logged (transaction not in database yet)`,
        issueType,
        issueDetails
      };
    }

    return {
      transferId,
      action: 'issue_flagged',
      message: `Transfer flagged for review due to ${issueType}`,
      issueType,
      issueDetails,
      transactionExists: true
    };

  } catch (error) {
    console.error('Error processing transfer issue:', error);
    throw error;
  }
}

// Process card transaction from webhook
async function processCardTransaction(data) {
  try {
    console.log('[Webhook] Processing card transaction...');

    const cardTransactionId = data.id || data.transaction_id;
    const profileId = data.profile_id || process.env.WISE_PROFILE_ID;

    if (!cardTransactionId) {
      throw new Error('Webhook missing required field: card transaction ID');
    }

    console.log('[Webhook] Card transaction details:', {
      transaction_id: cardTransactionId,
      type: data.type,
      state: data.state,
      merchant: data.merchant?.name,
      amount: data.amount?.value,
      currency: data.amount?.currency
    });

    // Map card transaction to normalized format
    const txnData = {
      wise_transaction_id: cardTransactionId,
      wise_resource_id: cardTransactionId,
      profile_id: profileId,
      account_id: data.card_id || data.account_id,
      type: data.type === 'CARD_DEBIT' || data.type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
      state: data.state || 'COMPLETED',
      amount: Math.abs(parseFloat(data.amount?.value || 0)),
      currency: data.amount?.currency,
      description: data.merchant?.name || data.description || 'Card Payment',
      merchant_name: data.merchant?.name || null,
      merchant_category: data.merchant?.category || null,
      merchant_city: data.merchant?.city || null,
      merchant_country: data.merchant?.country || null,
      reference_number: data.reference || cardTransactionId,
      transaction_date: data.createdAt || data.created_at || data.date,
      value_date: data.createdAt || data.created_at || data.date,
      raw_payload: data
    };

    // Process with shared processor
    const result = await wiseTransactionProcessor.processTransaction(txnData, 'webhook');

    console.log('[Webhook] Card transaction processed:', {
      transaction_id: txnData.wise_transaction_id,
      action: result.action,
      entry_created: result.entryCreated,
      merchant: txnData.merchant_name,
      amount: txnData.amount,
      currency: txnData.currency,
      confidence: result.confidence
    });

    return {
      transactionId: txnData.wise_transaction_id,
      action: result.action,
      message: result.entryCreated ? 'Card transaction imported and entry created' : 'Card transaction processed',
      entryCreated: result.entryCreated,
      entryId: result.entryId,
      confidence: result.confidence,
      merchant: txnData.merchant_name,
      amount: txnData.amount,
      currency: txnData.currency
    };

  } catch (error) {
    console.error('[Webhook] Error processing card transaction:', error);
    throw error;
  }
}

// Note: autoCreateEntry function removed - entries are now created inline during sync
// All Wise transactions are historical facts and are immediately marked as 'completed'

/**
 * POST /api/wise/sync
 * Complete Historical Sync using Balance Statements API
 * Fetches ALL transactions for each currency from account creation to now
 */
router.post('/sync', auth, syncCompleteHistory);

module.exports = router;
