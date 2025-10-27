const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const wiseClassifier = require('../services/wiseClassifier');
const WiseTransactionModel = require('../models/wiseTransactionModel');

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
function validateWebhookSignature(req) {
  const webhookSecret = process.env.WISE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('WISE_WEBHOOK_SECRET not configured');
    return false;
  }

  const signature = req.headers['x-signature'] || req.headers['x-wise-signature'] || req.headers['x-2fa-approval'] || req.headers['x-hub-signature'];

  if (!signature) {
    console.error('No signature header found in webhook request');
    console.error('Available headers:', Object.keys(req.headers).filter(h => h.startsWith('x-')));
    return false;
  }

  console.log('=== SIGNATURE VALIDATION DEBUG ===');
  console.log('Found signature in header:', signature);
  console.log('Webhook secret length:', webhookSecret.length);

  // Get raw body as string
  const payload = JSON.stringify(req.body);
  console.log('Payload to sign:', payload);
  console.log('Payload length:', payload.length);

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  console.log('Expected signature (HMAC-SHA256):', expectedSignature);
  console.log('Received signature:', signature);
  console.log('=== END SIGNATURE DEBUG ===');

  // Check if signatures have the same length first
  if (signature.length !== expectedSignature.length) {
    console.error('Webhook signature validation failed - length mismatch');
    console.error('Expected length:', expectedSignature.length);
    console.error('Received length:', signature.length);
    console.error('Expected:', expectedSignature);
    console.error('Received:', signature);
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
router.post('/webhook', express.json(), async (req, res) => {
  const startTime = Date.now();
  console.log('=== Wise Webhook Received ===');
  console.log('Timestamp:', new Date().toISOString());

  // DEBUG: Log everything about the request
  console.log('=== WEBHOOK DEBUG INFO ===');
  console.log('All Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Signature Header (x-signature):', req.headers['x-signature']);
  console.log('Signature Header (x-wise-signature):', req.headers['x-wise-signature']);
  console.log('Signature Header (x-2fa-approval):', req.headers['x-2fa-approval']);
  console.log('Signature Header (x-hub-signature):', req.headers['x-hub-signature']);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Raw Body as JSON String length:', JSON.stringify(req.body).length);
  console.log('=== END DEBUG INFO ===');

  try {
    // Validate signature
    const isValid = validateWebhookSignature(req);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Webhook signature validation failed'
      });
    }

    const event = req.body;
    console.log('Event Type:', event.event_type);
    console.log('Event Data:', JSON.stringify(event.data));

    // Handle test events
    if (event.event_type === 'test' || event.event_type === 'webhook#test') {
      console.log('✓ Test webhook received successfully');
      return res.status(200).json({
        success: true,
        message: 'Test webhook received'
      });
    }

    // Handle balance credit events (incoming money)
    if (event.event_type === 'balances#credit' || event.event_type === 'balance-transactions#credit') {
      console.log('Processing balance credit event...');
      await processBalanceTransaction(event.data, 'CREDIT');

      const elapsed = Date.now() - startTime;
      console.log(`✓ Balance credit processed in ${elapsed}ms`);
      return res.status(200).json({
        success: true,
        message: 'Balance credit processed'
      });
    }

    // Handle balance update events
    if (event.event_type === 'balances#update' || event.event_type === 'balance-transactions#update') {
      console.log('Processing balance update event...');
      await processBalanceTransaction(event.data, 'UPDATE');

      const elapsed = Date.now() - startTime;
      console.log(`✓ Balance update processed in ${elapsed}ms`);
      return res.status(200).json({
        success: true,
        message: 'Balance update processed'
      });
    }

    // Handle transfer state changes
    if (event.event_type === 'transfers#state-change') {
      console.log('Processing transfer state change...');
      await processTransferStateChange(event.data);

      const elapsed = Date.now() - startTime;
      console.log(`✓ Transfer state change processed in ${elapsed}ms`);
      return res.status(200).json({
        success: true,
        message: 'Transfer state change processed'
      });
    }

    // Handle transfer issues/active cases
    if (event.event_type === 'transfers#active-cases') {
      console.log('Processing transfer active case (issue)...');
      await processTransferIssue(event.data);

      const elapsed = Date.now() - startTime;
      console.log(`✓ Transfer issue processed in ${elapsed}ms`);
      return res.status(200).json({
        success: true,
        message: 'Transfer issue logged'
      });
    }

    // Unknown event type
    console.warn('Unknown event type:', event.event_type);
    return res.status(200).json({
      success: true,
      message: 'Event received but not processed'
    });

  } catch (error) {
    console.error('=== Webhook Processing Error ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Still return 200 to Wise to avoid retries for processing errors
    return res.status(200).json({
      success: false,
      error: 'Internal processing error',
      message: error.message
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
      return;
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

    // If high confidence (80%+) and doesn't need review, auto-create entry
    if (!classification.needsReview && classification.confidenceScore >= 80) {
      console.log('Auto-creating entry for high-confidence transaction...');
      await autoCreateEntry(savedTransaction, classification);
    } else {
      console.log('Transaction flagged for manual review');
    }

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
    } else {
      console.log(`Transaction ${transferId} not found in database`);
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
    }

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
