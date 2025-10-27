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

    // Get recent SUCCESSFUL webhooks from database (exclude failed validations)
    const dbWebhooks = await pool.query(`
      SELECT * FROM wise_sync_audit_log
      WHERE action = 'webhook_received'
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

// Webhook signature validation function
function validateWebhookSignature(rawBody, signature) {
  const webhookSecret = process.env.WISE_WEBHOOK_SECRET;

  // If no secret configured, ALLOW webhooks through (not an error!)
  if (!webhookSecret) {
    console.warn('⚠️ WISE_WEBHOOK_SECRET not set - skipping signature validation');
    console.warn('⚠️ Webhooks will be accepted without validation');
    return true; // ALLOW webhook when no secret configured
  }

  if (!signature) {
    console.error('No signature header found but WISE_WEBHOOK_SECRET is set');
    return false;
  }

  console.log('=== SIGNATURE VALIDATION DEBUG ===');
  console.log('Found signature in header:', signature);
  console.log('Webhook secret length:', webhookSecret.length);
  console.log('Raw body length:', rawBody.length);
  console.log('Raw body preview:', rawBody.substring(0, 200));

  // Calculate expected signature using RAW body (before JSON parsing)
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  console.log('Expected signature (HMAC-SHA256):', expectedSignature);
  console.log('Received signature:', signature);
  console.log('=== END SIGNATURE DEBUG ===');

  // Check if signatures have the same length first
  if (signature.length !== expectedSignature.length) {
    console.error('Webhook signature validation failed - length mismatch');
    console.error('Expected length:', expectedSignature.length);
    console.error('Received length:', signature.length);
    return false;
  }

  // Compare signatures using timing-safe comparison
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('Webhook signature validation failed');
      console.error('Expected:', expectedSignature);
      console.error('Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('Error during signature comparison:', error.message);
    return false;
  }
}

// POST /api/wise/webhook - Receive Wise webhook events
// Use express.raw to capture raw body BEFORE JSON parsing (needed for signature validation)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const startTime = Date.now();
  const receivedAt = new Date();

  // CHECK TEST NOTIFICATION FIRST - before ANY body parsing
  // Wise sends X-Test-Notification: true during URL validation
  if (req.headers['x-test-notification'] === 'true') {
    console.log('✓ Wise test notification received (URL validation)');
    console.log('Test headers:', {
      'x-test-notification': req.headers['x-test-notification'],
      'x-delivery-id': req.headers['x-delivery-id']
    });
    return res.status(200).json({
      success: true,
      message: 'Webhook endpoint validated successfully',
      timestamp: new Date().toISOString()
    });
  }

  console.log('=== Wise Webhook Received ===');
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
      console.log('✓ Minimal body validation request');
      return res.status(200).json({ status: 'ok' });
    }

    // Has body but no event_type = error
    console.error('Webhook body missing event_type:', rawBody.substring(0, 200));
    return res.status(400).json({
      error: 'Missing event_type',
      message: 'Webhook body must include event_type field'
    });
  }

  // DEBUG: Log everything about the request
  console.log('=== WEBHOOK DEBUG INFO ===');
  console.log('All Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Event Type:', event.event_type);
  console.log('Body:', JSON.stringify(event, null, 2));
  console.log('Signature Header (x-signature-sha256):', req.headers['x-signature-sha256']);
  console.log('Signature Header (x-signature):', req.headers['x-signature']);
  console.log('Signature Header (x-wise-signature):', req.headers['x-wise-signature']);
  console.log('Test Notification:', req.headers['x-test-notification']);
  console.log('Delivery ID:', req.headers['x-delivery-id']);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Raw Body length:', rawBody.length);
  console.log('=== END DEBUG INFO ===');

  // Create webhook tracking object
  const webhookData = {
    received_at: receivedAt,
    event_type: event.event_type,
    payload: event,
    headers: {
      signature: req.headers['x-signature-sha256'] || req.headers['x-signature'] || req.headers['x-wise-signature'],
      testNotification: req.headers['x-test-notification'],
      deliveryId: req.headers['x-delivery-id'],
      contentType: req.headers['content-type']
    },
    processing_status: 'received',
    processing_result: null,
    error: null
  };

  try {
    // Get signature from headers
    // NOTE: Wise official docs say they send X-Signature-SHA256
    const signature = req.headers['x-signature-sha256'] || req.headers['x-signature'] || req.headers['x-wise-signature'] || req.headers['x-2fa-approval'] || req.headers['x-hub-signature'];

    // Validate signature using RAW body
    const isValid = validateWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.error('Invalid webhook signature');

      // Log failed signature validation
      webhookData.processing_status = 'failed';
      webhookData.error = 'Invalid webhook signature';

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
          'webhook_signature_failed',
          'Webhook received but signature validation failed',
          JSON.stringify(webhookData)
        ]
      );

      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Webhook signature validation failed'
      });
    }

    // Signature is valid (or validation was skipped)
    console.log('✅ Webhook accepted');
    webhookData.processing_status = 'validated';

    console.log('Event Type:', event.event_type);
    console.log('Event Data:', JSON.stringify(event.data));

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
    // Extract transaction details from webhook payload
    const transactionId = data.resource?.id || data.transaction_id || data.id;
    const amount = Math.abs(parseFloat(data.amount?.value || data.amount || 0));
    const currency = data.amount?.currency || data.currency || 'USD';
    const description = data.details?.description || data.description || '';
    const merchantName = data.details?.merchant_name || data.merchant_name || '';
    const referenceNumber = data.details?.reference || data.reference || '';
    const transactionDate = data.created_time || data.transaction_date || new Date().toISOString();

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
      currency,
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
      wiseResourceId: data.resource?.id || null,
      profileId: data.profile_id || process.env.WISE_PROFILE_ID,
      accountId: data.account_id || null,
      type: direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      state: data.state || 'completed',
      amount,
      currency,
      description,
      merchantName,
      referenceNumber,
      transactionDate,
      valueDate: data.value_date || transactionDate,
      syncStatus: classification.needsReview ? 'pending' : 'pending',
      classifiedCategory: classification.category,
      matchedEmployeeId: classification.employeeId,
      confidenceScore: classification.confidenceScore,
      needsReview: classification.needsReview,
      rawPayload: data
    });

    console.log(`✓ Transaction saved: ${transactionId}`);
    console.log(`  Category: ${classification.category}`);
    console.log(`  Confidence: ${classification.confidenceScore}%`);
    console.log(`  Needs Review: ${classification.needsReview}`);

    let entryCreated = false;

    // If high confidence (80%+) and doesn't need review, auto-create entry
    if (!classification.needsReview && classification.confidenceScore >= 80) {
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
      currency
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

module.exports = router;
