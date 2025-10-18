const express = require('express');
const multer = require('multer');
const router = express.Router();
const db = require('../config/database');
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

// POST /api/wise/import - Upload and import Wise CSV
router.post('/import', auth, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    let imported = 0;
    let skipped = 0;
    let errors = [];

    const client = await db.pool.getClient();

    try {
      await client.query('BEGIN');

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);

        const [
          id, status, direction, createdOn, finishedOn,
          sourceFeeAmount, sourceFeeCurrency, targetFeeAmount, targetFeeCurrency,
          sourceName, sourceAmount, sourceCurrency,
          targetName, targetAmount, targetCurrency,
          exchangeRate, reference, batch, createdBy, wiseCategory, note
        ] = fields;

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

        try {
          const existingCheck = await client.query(
            'SELECT id FROM entries WHERE detail LIKE $1',
            [`%Wise ID: ${id}%`]
          );

          if (existingCheck.rows.length > 0) {
            skipped++;
            continue;
          }

          await client.query(
            `INSERT INTO entries
             (type, category, description, detail, base_amount, total, entry_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [type, category, description, detail, amount, amount, entryDate, 'completed']
          );

          imported++;
        } catch (err) {
          errors.push({ line: i + 1, id, error: err.message });
        }
      }

      await client.query('COMMIT');

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

      res.json({
        success: true,
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
        errorDetails: errors.length > 0 ? errors : undefined
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error importing Wise CSV:', error);
    res.status(500).json({ error: 'Failed to import CSV', details: error.message });
  }
});

module.exports = router;
