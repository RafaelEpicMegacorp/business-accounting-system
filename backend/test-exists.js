require('dotenv').config();
const pool = require('./src/config/database');
const WiseTransactionModel = require('./src/models/wiseTransactionModel');

async function test() {
  try {
    console.log('Testing WiseTransactionModel.exists()...\n');

    const testId = 'TRANSFER-123456789';
    console.log('Test ID:', testId);

    const result = await WiseTransactionModel.exists(testId);
    console.log('WiseTransactionModel.exists() returned:', result);

    // Also query directly to see what's in the table
    const countResult = await pool.query('SELECT COUNT(*) as count FROM wise_transactions');
    console.log('Total transactions in database:', countResult.rows[0].count);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
