const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Database configuration - use Railway production by default
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'VSDwOduVchAHaBYXJrtoFvJBgLOQHUpz',
  host: process.env.DB_HOST || 'gondola.proxy.rlwy.net',
  port: process.env.DB_PORT || 41656,
  database: process.env.DB_NAME || 'railway'
});

// Category mapping from Wise categories to our accounting system
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
      i++; // Skip next quote
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
  // Format: "2025-10-17 10:55:32"
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
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

  // Default categories
  return type === 'income' ? 'other_income' : 'other_expenses';
}

async function importTransactions(csvFilePath) {
  console.log('Starting Wise transaction import...');
  console.log('Reading CSV file:', csvFilePath);

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());

  console.log(`Found ${lines.length - 1} transactions in CSV`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i]);

      const [
        id, status, direction, createdOn, finishedOn,
        sourceFeeAmount, sourceFeeCurrency, targetFeeAmount, targetFeeCurrency,
        sourceName, sourceAmount, sourceCurrency,
        targetName, targetAmount, targetCurrency,
        exchangeRate, reference, batch, createdBy, wiseCategory, note
      ] = fields;

      // Skip cancelled, refunded transactions
      if (status === 'CANCELLED' || status === 'REFUNDED') {
        skipped++;
        continue;
      }

      // Determine amount and currency to use
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

      // Create description
      let description = targetName || sourceName || 'Wise Transaction';
      if (reference) description += ` (${reference})`;

      // Detail includes note and created by
      let detail = `Wise ID: ${id}\n`;
      if (note) detail += `Note: ${note}\n`;
      if (createdBy) detail += `Created by: ${createdBy}`;

      try {
        // Check if transaction already exists by Wise ID
        const existingCheck = await client.query(
          'SELECT id FROM entries WHERE detail LIKE $1',
          [`%Wise ID: ${id}%`]
        );

        if (existingCheck.rows.length > 0) {
          skipped++;
          continue;
        }

        // Insert transaction
        await client.query(
          `INSERT INTO entries
           (type, category, description, detail, base_amount, total, entry_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [type, category, description, detail, amount, amount, entryDate, 'completed']
        );

        imported++;

        if (imported % 50 === 0) {
          console.log(`Progress: ${imported} imported, ${skipped} skipped`);
        }
      } catch (err) {
        console.error(`Error importing transaction ${id}:`, err.message);
        errors++;
      }
    }

    await client.query('COMMIT');

    console.log('\n=== Import Summary ===');
    console.log(`✅ Imported: ${imported} transactions`);
    console.log(`⏭️  Skipped: ${skipped} transactions (cancelled/refunded/duplicate/zero-amount)`);
    console.log(`❌ Errors: ${errors} transactions`);
    console.log('=====================\n');

    // Calculate balance
    const balanceResult = await client.query(`
      SELECT
        SUM(CASE WHEN type = 'income' THEN total ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN total ELSE 0 END) as total_expenses
      FROM entries
    `);

    const { total_income, total_expenses } = balanceResult.rows[0];
    const balance = (parseFloat(total_income) || 0) - (parseFloat(total_expenses) || 0);

    console.log('Current Account Balance:');
    console.log(`  Income: $${parseFloat(total_income || 0).toFixed(2)}`);
    console.log(`  Expenses: $${parseFloat(total_expenses || 0).toFixed(2)}`);
    console.log(`  Balance: $${balance.toFixed(2)}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
const csvPath = process.argv[2] || '/Users/rafael/Downloads/transaction-history (1).csv';
importTransactions(csvPath)
  .then(() => {
    console.log('Import completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
