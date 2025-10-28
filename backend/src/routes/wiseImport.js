const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const wiseClassifier = require('../services/wiseClassifier');
const WiseTransactionModel = require('../models/wiseTransactionModel');

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

// Category mapping
const categoryMapping = {
  'Office expenses': 'office_supplies',
  'Contract services': 'contractor_payments',
  'Software and web hosting': 'software_subscriptions',
  'Marketing': 'marketing',
  'Travel': 'travel',
  'General': 'other_expenses',
  'Entertainment': 'meals_entertainment',
  'Rewards': 'other_income',
  'Money added': 'bank_transfer'
};

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
  return date.toISOString().split('T')[0];
}

function determineType(direction, category) {
  if (direction === 'IN' || category === 'Rewards' || category === 'Money added') {
    return 'income';
  }
  return 'expense';
}

function getCategory(wiseCategory, type) {
  const mapped = categoryMapping[wiseCategory];
  if (mapped) return mapped;
  return type === 'income' ? 'other_income' : 'other_expenses';
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
  console.log('=== CSV Import Started ===');
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

    // Check if header matches expected format (case-insensitive)
    const headerLower = headerFields.map(h => h.trim().toLowerCase());
    const expectedLower = EXPECTED_HEADERS.map(h => h.toLowerCase());

    if (headerFields.length !== 21) {
      console.error('ERROR: Wrong number of columns. Expected 21, got', headerFields.length);
      return res.status(400).json({
        error: 'Invalid CSV format',
        details: `CSV must have 21 columns (Wise export format). Found ${headerFields.length} columns. Please export from Wise: Account → Statements → Export → CSV`
      });
    }

    // Verify key columns exist
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

    let imported = 0;
    let skipped = 0;
    let errors = [];

    // Get database client
    let client;
    try {
      client = await pool.getClient();
      console.log('✓ Database connection established');
    } catch (err) {
      console.error('ERROR: Failed to connect to database:', err.message);
      return res.status(500).json({
        error: 'Database connection failed',
        details: 'Unable to connect to database. Please try again later.'
      });
    }

    try {
      await client.query('BEGIN');
      console.log('✓ Transaction started');

      for (let i = 1; i < lines.length; i++) {
        try {
          const fields = parseCSVLine(lines[i]);

          // Validate row has correct number of fields
          if (fields.length !== 21) {
            const errorMsg = `Row ${i + 1}: Expected 21 fields, found ${fields.length}`;
            console.warn('SKIP:', errorMsg);
            errors.push({ line: i + 1, error: errorMsg });
            skipped++;
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
            const errorMsg = `Row ${i + 1}: Missing transaction ID`;
            console.warn('SKIP:', errorMsg);
            errors.push({ line: i + 1, error: errorMsg });
            skipped++;
            continue;
          }

          if (status === 'CANCELLED' || status === 'REFUNDED') {
            skipped++;
            continue;
          }

          let amount, currency;
          if (direction === 'OUT') {
            amount = parseCurrency(sourceAmount);
            currency = sourceCurrency;
          } else {
            amount = parseCurrency(targetAmount);
            currency = targetCurrency;
          }

          if (!amount || amount === 0) {
            skipped++;
            continue;
          }

          const type = determineType(direction, wiseCategory);
          const category = getCategory(wiseCategory, type);
          const entryDate = parseDate(finishedOn) || parseDate(createdOn);

          let description = targetName || sourceName || 'Wise Transaction';
          if (reference) description += ` (${reference})`;

          let detail = `Wise ID: ${id}\n`;
          if (note) detail += `Note: ${note}\n`;
          if (createdBy) detail += `Created by: ${createdBy}`;

          // Check for existing entry
          const existingCheck = await client.query(
            'SELECT id FROM entries WHERE detail LIKE $1',
            [`%Wise ID: ${id}%`]
          );

          if (existingCheck.rows.length > 0) {
            skipped++;
            continue;
          }

          // Insert new entry
          await client.query(
            `INSERT INTO entries
             (type, category, description, detail, base_amount, total, entry_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [type, category, description, detail, amount, amount, entryDate, 'completed']
          );

          imported++;

        } catch (rowErr) {
          const errorMsg = `Row ${i + 1}: ${rowErr.message}`;
          console.error('ERROR processing row:', errorMsg);
          errors.push({ line: i + 1, id: fields[0] || 'unknown', error: rowErr.message });
          // Continue processing other rows
        }
      }

      console.log('Processing complete. Imported:', imported, 'Skipped:', skipped, 'Errors:', errors.length);

      await client.query('COMMIT');
      console.log('✓ Transaction committed');

      // Get updated balance
      const balanceResult = await client.query(`
        SELECT
          SUM(CASE WHEN type = 'income' THEN total ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN total ELSE 0 END) as total_expenses,
          COUNT(*) as total_entries
        FROM entries
      `);

      const { total_income, total_expenses, total_entries } = balanceResult.rows[0];
      const balance = (parseFloat(total_income) || 0) - (parseFloat(total_expenses) || 0);

      const response = {
        success: true,
        message: `Successfully processed ${lines.length - 1} transactions`,
        summary: {
          imported,
          skipped,
          errors: errors.length,
          totalProcessed: lines.length - 1
        },
        balance: {
          totalIncome: parseFloat(total_income) || 0,
          totalExpenses: parseFloat(total_expenses) || 0,
          netBalance: balance,
          totalEntries: parseInt(total_entries)
        },
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Show first 10 errors
      };

      console.log('=== Import Complete ===');
      console.log('Response:', JSON.stringify(response.summary));
      res.json(response);

    } catch (err) {
      console.error('ERROR during transaction:', err.message);
      console.error('Stack:', err.stack);
      await client.query('ROLLBACK');
      console.log('✓ Transaction rolled back');
      throw err;
    } finally {
      client.release();
      console.log('✓ Database connection released');
    }

  } catch (error) {
    console.error('=== Import Failed ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Provide specific error messages based on error type
    let errorResponse = {
      error: 'Failed to import CSV',
      details: error.message
    };

    if (error.message.includes('connect')) {
      errorResponse.error = 'Database connection failed';
      errorResponse.details = 'Unable to connect to database. Please try again later.';
    } else if (error.message.includes('permission')) {
      errorResponse.error = 'Permission denied';
      errorResponse.details = 'You do not have permission to import transactions.';
    } else if (error.message.includes('duplicate')) {
      errorResponse.error = 'Duplicate transaction';
      errorResponse.details = 'Some transactions already exist in the database.';
    }

    res.status(500).json(errorResponse);
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
      `INSERT INTO wise_sync_audit_log (action, notes, new_values)
       VALUES ($1, $2, $3)`,
      [
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
    // Extract resource ID and timestamp from webhook
    const balanceId = data.resource?.id;
    const occurredAt = data.occurred_at;
    const profileId = data.profile_id || process.env.WISE_PROFILE_ID;

    if (!balanceId || !occurredAt) {
      throw new Error('Webhook missing required fields: resource.id or occurred_at');
    }

    console.log('Fetching transaction details from Wise API...');
    console.log(`  Balance ID: ${balanceId}`);
    console.log(`  Occurred At: ${occurredAt}`);
    console.log(`  Profile ID: ${profileId}`);

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

    console.log(`  API URL: ${statementUrl}`);

    const response = await fetch(statementUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Wise API Error:', response.status, errorText);
      throw new Error(`Wise API returned ${response.status}: ${errorText}`);
    }

    const statement = await response.json();
    console.log(`  ✓ Received statement with ${statement.transactions?.length || 0} transactions`);

    // Find the transaction that matches our event time
    const transactions = statement.transactions || [];
    const matchingTransaction = transactions.find(txn => {
      const txnTime = new Date(txn.date);
      const timeDiff = Math.abs(txnTime.getTime() - eventTime.getTime());
      return timeDiff < 60000; // Within 1 minute of event time
    });

    if (!matchingTransaction) {
      console.log('  ⚠️ No matching transaction found in statement');
      return {
        action: 'not_found',
        message: 'Transaction not found in statement',
        balanceId,
        occurredAt
      };
    }

    console.log('  ✓ Found matching transaction');

    // Extract transaction details from API response
    const transactionId = matchingTransaction.referenceNumber;
    const amount = Math.abs(parseFloat(matchingTransaction.amount.value));
    const txnCurrency = matchingTransaction.amount.currency;
    const description = matchingTransaction.details?.description || '';
    const merchantName = matchingTransaction.details?.senderName || matchingTransaction.details?.recipientName || '';
    const referenceNumber = matchingTransaction.referenceNumber;
    const transactionDate = matchingTransaction.date;

    // Check for duplicates
    const existing = await WiseTransactionModel.exists(transactionId);
    if (existing) {
      console.log(`Transaction ${transactionId} already exists, skipping`);
      return {
        transactionId,
        action: 'skipped',
        message: 'Transaction already exists in database'
      };
    }

    // Prepare transaction data for classification
    const transactionData = {
      type: direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      amount,
      currency: txnCurrency,
      description,
      merchantName,
      referenceNumber,
      transactionDate
    };

    // Classify transaction
    console.log('Classifying transaction...');
    const classification = await wiseClassifier.classifyTransaction(transactionData);
    console.log('Classification result:', {
      category: classification.category,
      confidence: classification.confidenceScore,
      needsReview: classification.needsReview,
      employeeId: classification.employeeId
    });

    // Store transaction in database
    const savedTransaction = await WiseTransactionModel.create({
      wiseTransactionId: transactionId,
      wiseResourceId: balanceId,
      profileId: profileId,
      accountId: balanceId,
      type: matchingTransaction.type, // CREDIT or DEBIT from API
      state: 'completed',
      amount,
      currency: txnCurrency,
      description,
      merchantName,
      referenceNumber,
      transactionDate,
      valueDate: transactionDate,
      syncStatus: classification.needsReview ? 'pending' : 'pending',
      classifiedCategory: classification.category,
      matchedEmployeeId: classification.employeeId,
      confidenceScore: classification.confidenceScore,
      needsReview: classification.needsReview,
      rawPayload: matchingTransaction
    });

    console.log(`✓ Transaction saved: ${transactionId}`);
    console.log(`  Category: ${classification.category}`);
    console.log(`  Confidence: ${classification.confidenceScore}%`);
    console.log(`  Needs Review: ${classification.needsReview}`);

    let entryCreated = false;

    // If confidence meets threshold (40% per CLAUDE.md line 784) and doesn't need review, auto-create entry
    if (!classification.needsReview && classification.confidenceScore >= 40) {
      console.log('Auto-creating entry for high-confidence transaction...');
      await autoCreateEntry(savedTransaction, classification);
      entryCreated = true;
    } else {
      console.log('Transaction flagged for manual review');
    }

    return {
      transactionId,
      action: 'created',
      message: `Transaction saved with ${classification.confidenceScore}% confidence`,
      transactionDbId: savedTransaction.id,
      category: classification.category,
      confidence: classification.confidenceScore,
      needsReview: classification.needsReview,
      entryCreated,
      amount,
      currency: txnCurrency
    };

  } catch (error) {
    console.error('Error processing balance transaction:', error);
    throw error;
  }
}

// Process transfer state change from webhook
async function processTransferStateChange(data) {
  try {
    const transferId = data.resource?.id || data.transfer_id || data.id;
    const currentState = data.current_state || data.state;

    console.log(`Transfer ${transferId} changed to state: ${currentState}`);

    // Check if we have this transaction
    const existing = await WiseTransactionModel.getByWiseId(transferId);

    if (existing) {
      // Update transaction state
      await WiseTransactionModel.updateStatus(transferId, {
        state: currentState
      });
      console.log(`✓ Updated transaction state for ${transferId}`);

      return {
        transferId,
        action: 'updated',
        message: `Transfer state updated to ${currentState}`,
        previousState: existing.state,
        currentState
      };
    } else {
      console.log(`Transaction ${transferId} not found in database`);

      return {
        transferId,
        action: 'not_found',
        message: 'Transfer not found in database',
        currentState
      };
    }

  } catch (error) {
    console.error('Error processing transfer state change:', error);
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

// Auto-create accounting entry from high-confidence transaction
async function autoCreateEntry(transaction, classification) {
  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    // Determine entry type
    const entryType = transaction.type === 'CREDIT' ? 'income' : 'expense';

    // Map classified category to entry category
    let entryCategory;
    if (classification.category === 'Employee') {
      entryCategory = 'salaries';
    } else if (classification.category === 'Client Payment') {
      entryCategory = 'consulting';
    } else if (classification.category === 'Other Expenses') {
      entryCategory = 'other_expenses';
    } else if (classification.category === 'Other Income') {
      entryCategory = 'other_income';
    } else {
      entryCategory = classification.category.toLowerCase().replace(/ /g, '_');
    }

    // Create description
    let description = transaction.description || transaction.merchant_name || 'Wise Transaction';
    if (classification.employeeId) {
      const empResult = await client.query('SELECT name FROM employees WHERE id = $1', [classification.employeeId]);
      if (empResult.rows[0]) {
        description = `Salary - ${empResult.rows[0].name}`;
      }
    }

    // Create detail with Wise info
    let detail = `Auto-imported from Wise\nWise ID: ${transaction.wise_transaction_id}\n`;
    if (transaction.reference_number) {
      detail += `Reference: ${transaction.reference_number}\n`;
    }
    detail += `Confidence: ${classification.confidenceScore}%\n`;
    detail += `Classification: ${classification.reasoning.join(', ')}`;

    // Insert entry
    const entryResult = await client.query(
      `INSERT INTO entries
       (type, category, description, detail, base_amount, total, entry_date, status, employee_id, currency, amount_original)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        entryType,
        entryCategory,
        description,
        detail,
        transaction.amount,
        transaction.amount,
        transaction.transaction_date.split('T')[0],
        'completed',
        classification.employeeId || null,
        transaction.currency,
        transaction.amount
      ]
    );

    const entryId = entryResult.rows[0].id;

    // Update transaction as processed
    await client.query(
      `UPDATE wise_transactions
       SET sync_status = 'processed', entry_id = $1, processed_at = CURRENT_TIMESTAMP
       WHERE wise_transaction_id = $2`,
      [entryId, transaction.wise_transaction_id]
    );

    await client.query('COMMIT');

    console.log(`✓ Entry created for Wise transaction ${transaction.wise_transaction_id}: ${description} (${entryType} ${transaction.currency} ${transaction.amount})`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating entry:', error);

    // Mark transaction as failed
    await WiseTransactionModel.markAsFailed(transaction.wise_transaction_id, error.message);

    throw error;
  } finally {
    client.release();
  }
}

/**
 * POST /api/wise/sync
 * Manual sync from Wise Activities API
 */
router.post('/sync', auth, async (req, res) => {
  console.log('🔄 Manual Wise sync triggered');

  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';
  const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

  if (!WISE_API_TOKEN || !WISE_PROFILE_ID) {
    return res.status(500).json({
      success: false,
      error: 'Wise API not configured. Missing WISE_API_TOKEN or WISE_PROFILE_ID'
    });
  }

  const stats = {
    activitiesFound: 0,
    transfersProcessed: 0,
    newTransactions: 0,
    duplicatesSkipped: 0,
    entriesCreated: 0,
    errors: 0,
    errorDetails: []
  };

  try {
    // Fetch activities from Wise
    console.log('📋 Fetching activities from Wise API...');
    const activitiesResponse = await fetch(
      `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!activitiesResponse.ok) {
      const errorText = await activitiesResponse.text();
      throw new Error(`Wise API error: ${activitiesResponse.status} ${errorText}`);
    }

    const activitiesData = await activitiesResponse.json();
    const activities = activitiesData.activities || [];
    stats.activitiesFound = activities.length;

    console.log(`✓ Found ${activities.length} activities`);

    if (activities.length === 0) {
      return res.json({
        success: true,
        message: 'No activities found in Wise account',
        stats
      });
    }

    // Process each TRANSFER activity
    for (const activity of activities) {
      if (activity.type !== 'TRANSFER' || !activity.resource?.id) {
        continue;
      }

      try {
        const transferId = activity.resource.id;
        console.log(`📝 Fetching transfer ${transferId}...`);

        // Get full transfer details
        const transferResponse = await fetch(
          `${WISE_API_URL}/v1/transfers/${transferId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${WISE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!transferResponse.ok) {
          throw new Error(`Transfer API error: ${transferResponse.status}`);
        }

        const transfer = await transferResponse.json();
        stats.transfersProcessed++;

        // Create transaction ID
        const transactionId = transfer.customerTransactionId || `TRANSFER-${transfer.id}`;

        // Check for duplicates
        const existing = await WiseTransactionModel.exists(transactionId);
        if (existing) {
          stats.duplicatesSkipped++;
          console.log(`⏭️  Skipping duplicate: ${transactionId}`);
          continue;
        }

        // Extract transfer details
        const amount = Math.abs(parseFloat(transfer.sourceValue || transfer.targetValue));
        const currency = transfer.sourceCurrency || transfer.targetCurrency;
        const description = transfer.details?.reference || '';
        const transactionDate = transfer.created;
        const type = transfer.sourceValue ? 'DEBIT' : 'CREDIT';

        // Classify transaction
        const transactionData = {
          type,
          amount,
          currency,
          description,
          merchantName: '',
          referenceNumber: transactionId,
          transactionDate
        };

        const classification = await wiseClassifier.classifyTransaction(transactionData);
        console.log(`[Wise Sync] Transaction ${transactionId} classified:`, {
          category: classification.category,
          confidence: classification.confidenceScore,
          needsReview: classification.needsReview,
          reasoning: classification.reasoning
        });

        // Store transaction
        await WiseTransactionModel.create({
          wiseTransactionId: transactionId,
          wiseResourceId: transfer.id.toString(),
          profileId: WISE_PROFILE_ID,
          accountId: transfer.sourceAccount || transfer.targetAccount,
          type,
          state: transfer.status || 'completed',
          amount,
          currency,
          description,
          merchantName: '',
          referenceNumber: transactionId,
          transactionDate,
          valueDate: transactionDate,
          syncStatus: classification.needsReview ? 'pending' : 'pending',
          classifiedCategory: classification.category,
          matchedEmployeeId: classification.employeeId,
          confidenceScore: classification.confidenceScore,
          needsReview: classification.needsReview,
          rawPayload: transfer
        });

        stats.newTransactions++;
        console.log(`✅ Imported: ${transactionId} - ${description} (${amount} ${currency})`);

        // Auto-create entry if confidence meets threshold (40% per CLAUDE.md line 784)
        if (!classification.needsReview && classification.confidenceScore >= 40) {
          // Get exchange rate if needed
          let amountUsd = amount;
          let exchangeRate = 1;

          if (currency !== 'USD') {
            const rateResponse = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
            const rateData = await rateResponse.json();
            exchangeRate = rateData.rates.USD;
            amountUsd = amount * exchangeRate;
          }

          const entryType = type === 'CREDIT' ? 'income' : 'expense';
          const category = classification.category;

          await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id, currency, amount_original, amount_usd, exchange_rate)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              entryType,
              category,
              description || 'Wise transaction',
              `Auto-imported from Wise (Ref: ${transactionId})`,
              amount,
              amount,
              transactionDate.split('T')[0],
              'completed',
              classification.employeeId || null,
              currency,
              amount,
              amountUsd,
              exchangeRate
            ]
          );

          stats.entriesCreated++;
          console.log(`✓ Entry auto-created`);
        }
        // If confidence is low but transaction is valid, create entry as "pending" for manual review
        else if (classification.confidenceScore >= 20 && classification.category !== 'Uncategorized') {
          console.log(`⚠️  Creating pending entry for low-confidence transaction...`);

          // Get exchange rate if needed
          let amountUsd = amount;
          let exchangeRate = 1;

          if (currency !== 'USD') {
            try {
              const rateResponse = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
              const rateData = await rateResponse.json();
              exchangeRate = rateData.rates.USD;
              amountUsd = amount * exchangeRate;
            } catch (err) {
              console.warn('Failed to get exchange rate, using 1:1');
            }
          }

          const entryType = type === 'CREDIT' ? 'income' : 'expense';
          const category = classification.category;

          const entryResult = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id, currency, amount_original, amount_usd, exchange_rate)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id`,
            [
              entryType,
              category,
              `${description || 'Wise transaction'} (Requires Review)`,
              `Auto-imported from Wise. Confidence: ${classification.confidenceScore}%. Ref: ${transactionId}`,
              amount,
              amount,
              transactionDate.split('T')[0],
              'pending', // Mark as pending for manual review
              classification.employeeId || null,
              currency,
              amount,
              amountUsd,
              exchangeRate
            ]
          );

          // Link entry to transaction
          await WiseTransactionModel.updateStatus(transactionId, {
            entryId: entryResult.rows[0].id,
            syncStatus: 'pending_review'
          });

          stats.entriesCreated++;
          console.log(`⚠️  Pending entry created (${classification.confidenceScore}% confidence)`);
        } else {
          console.log(`⏭️  Skipping entry creation - confidence too low or uncategorized`);
        }

      } catch (error) {
        stats.errors++;
        stats.errorDetails.push({
          transferId: activity.resource.id,
          error: error.message
        });
        console.error(`❌ Error processing transfer ${activity.resource.id}:`, error.message);
      }
    }

    console.log(`\n✅ Sync complete: ${stats.newTransactions} new, ${stats.duplicatesSkipped} duplicates, ${stats.entriesCreated} entries, ${stats.errors} errors`);

    res.json({
      success: true,
      message: 'Wise sync completed',
      stats
    });

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stats
    });
  }
});

module.exports = router;
