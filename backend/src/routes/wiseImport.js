const express = require('express');
const multer = require('multer');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

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

module.exports = router;
