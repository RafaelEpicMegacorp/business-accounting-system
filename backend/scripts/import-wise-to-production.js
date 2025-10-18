const fs = require('fs');
const { Pool } = require('pg');

// Use the exact DATABASE_URL format that Railway provides
const DATABASE_URL = "postgresql://postgres:VSDwOduVchAHaBYXJrtoFvJBgLOQHUpz@gondola.proxy.rlwy.net:41656/railway";

const pool = new Pool({
  connectionString: DATABASE_URL
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

async function importTransactions(csvFilePath) {
  console.log('🚀 Starting Wise transaction import to PRODUCTION...');
  console.log('📂 Reading CSV file:', csvFilePath);

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());

  console.log(`📊 Found ${lines.length - 1} transactions in CSV\n`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

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

        if (imported % 50 === 0) {
          console.log(`⏳ Progress: ${imported} imported, ${skipped} skipped`);
        }
      } catch (err) {
        console.error(`❌ Error importing transaction ${id}:`, err.message);
        errors++;
      }
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(50));
    console.log('📈 IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Imported: ${imported} transactions`);
    console.log(`⏭️  Skipped: ${skipped} (cancelled/refunded/duplicate/zero)`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50) + '\n');

    const balanceResult = await client.query(`
      SELECT
        SUM(CASE WHEN type = 'income' THEN total ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN total ELSE 0 END) as total_expenses
      FROM entries
    `);

    const { total_income, total_expenses } = balanceResult.rows[0];
    const balance = (parseFloat(total_income) || 0) - (parseFloat(total_expenses) || 0);

    console.log('💰 PRODUCTION ACCOUNT BALANCE');
    console.log('='.repeat(50));
    console.log(`  Income:   $${parseFloat(total_income || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`  Expenses: $${parseFloat(total_expenses || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`  Balance:  $${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log('='.repeat(50) + '\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('💥 Import failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const csvPath = process.argv[2] || '/Users/rafael/Downloads/transaction-history (1).csv';
importTransactions(csvPath)
  .then(() => {
    console.log('🎉 Import completed successfully!');
    console.log('🌐 Check your production site: https://ds-accounting.netlify.app\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Import failed:', err);
    process.exit(1);
  });
