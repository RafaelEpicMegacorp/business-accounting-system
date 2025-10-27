#!/usr/bin/env node

/**
 * Wise Historical Transaction Sync Script
 *
 * Fetches complete transaction history from Wise API and imports into accounting system.
 *
 * Usage:
 *   node scripts/sync-wise-historical.js [months]
 *
 * Arguments:
 *   months - Number of months to sync (default: 18)
 *
 * Environment Variables Required:
 *   WISE_API_TOKEN - Wise API token
 *   WISE_API_BASE_URL - Wise API URL (default: https://api.wise.com)
 *   WISE_PROFILE_ID - Wise profile ID
 *   DATABASE_URL - PostgreSQL connection string
 */

require('dotenv').config();
const pool = require('../src/config/database');
const wiseClassifier = require('../src/services/wiseClassifier');
const WiseTransactionModel = require('../src/models/wiseTransactionModel');

// Configuration
const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_API_URL = process.env.WISE_API_URL || process.env.WISE_API_BASE_URL || 'https://api.wise.com';
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;
const MONTHS_TO_SYNC = parseInt(process.argv[2]) || 18;

// Rate limiting
const REQUESTS_PER_MINUTE = 90; // Conservative (Wise limit is 100)
const DELAY_BETWEEN_REQUESTS = Math.ceil(60000 / REQUESTS_PER_MINUTE);

// Statistics
const stats = {
  totalTransactions: 0,
  newTransactions: 0,
  duplicates: 0,
  entriesCreated: 0,
  highConfidence: 0,
  needsReview: 0,
  errors: 0,
  byCurrency: {}
};

// Helper: Delay for rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Fetch with retry and rate limiting
async function fetchWithRetry(url, options, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await delay(DELAY_BETWEEN_REQUESTS);

      const response = await fetch(url, options);

      if (response.status === 429) {
        console.warn(`⚠️  Rate limited, waiting 60 seconds (attempt ${attempt}/${retries})...`);
        await delay(60000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`⚠️  Request failed (attempt ${attempt}/${retries}): ${error.message}`);
      await delay(5000 * attempt); // Exponential backoff
    }
  }
}

// Step 1: Get all balance accounts
async function getBalanceAccounts() {
  console.log('\n📊 Fetching balance accounts...');

  const url = `${WISE_API_URL}/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`;
  const balances = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WISE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`✓ Found ${balances.length} balance accounts:`);
  balances.forEach(b => {
    console.log(`   - ${b.currency}: ${b.amount.value} (Balance ID: ${b.id})`);
    stats.byCurrency[b.currency] = { transactions: 0, amount: 0 };
  });

  return balances;
}

// Step 2: Get transaction history for a balance
async function getTransactionHistory(balance, startDate, endDate) {
  const { id: balanceId, currency } = balance;
  console.log(`\n💰 Fetching ${currency} transactions...`);
  console.log(`   Balance ID: ${balanceId}`);
  console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  const url = `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/balance-statements/${balanceId}/statement.json`;
  const params = new URLSearchParams({
    currency: currency,
    intervalStart: startDate.toISOString(),
    intervalEnd: endDate.toISOString(),
    type: 'COMPACT'
  });

  try {
    const statement = await fetchWithRetry(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const transactions = statement.transactions || [];
    console.log(`✓ Fetched ${transactions.length} ${currency} transactions`);

    return transactions;
  } catch (error) {
    console.error(`❌ Failed to fetch ${currency} transactions:`, error.message);
    stats.errors++;
    return [];
  }
}

// Step 3: Process a single transaction
async function processTransaction(transaction, currency, client) {
  try {
    // Extract transaction details
    const transactionId = transaction.referenceNumber || `${transaction.date}_${transaction.amount.value}_${Math.random()}`;
    const amount = Math.abs(parseFloat(transaction.amount.value));
    const type = transaction.type === 'DEBIT' ? 'DEBIT' : 'CREDIT';
    const description = transaction.details?.description || transaction.description || '';
    const merchantName = transaction.details?.merchant?.name || '';
    const referenceNumber = transaction.referenceNumber || '';
    const transactionDate = new Date(transaction.date);

    stats.totalTransactions++;
    stats.byCurrency[currency].transactions++;

    // Check for duplicates
    const existing = await WiseTransactionModel.exists(transactionId);
    if (existing) {
      stats.duplicates++;
      return null;
    }

    stats.newTransactions++;

    // Classify transaction
    const classification = await wiseClassifier.classifyTransaction({
      type,
      amount,
      currency,
      description,
      merchantName,
      referenceNumber,
      transactionDate: transactionDate.toISOString()
    });

    // Store transaction
    const savedTransaction = await WiseTransactionModel.create({
      wiseTransactionId: transactionId,
      wiseResourceId: transaction.resourceId || null,
      profileId: WISE_PROFILE_ID,
      accountId: transaction.accountId || null,
      type,
      state: 'completed',
      amount,
      currency,
      description,
      merchantName,
      referenceNumber,
      transactionDate: transactionDate.toISOString(),
      valueDate: transactionDate.toISOString(),
      syncStatus: 'pending',
      classifiedCategory: classification.category,
      matchedEmployeeId: classification.employeeId,
      confidenceScore: classification.confidenceScore,
      needsReview: classification.needsReview,
      rawPayload: transaction
    });

    // Track confidence
    if (classification.confidenceScore >= 80) {
      stats.highConfidence++;
    } else {
      stats.needsReview++;
    }

    // Create accounting entry
    const entryType = type === 'CREDIT' ? 'income' : 'expense';

    // Map category
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

    // Create entry description
    let entryDescription = description || merchantName || 'Wise Transaction';
    if (classification.employeeId) {
      const empResult = await client.query('SELECT name FROM employees WHERE id = $1', [classification.employeeId]);
      if (empResult.rows[0]) {
        entryDescription = `Salary - ${empResult.rows[0].name}`;
      }
    }

    // Create entry detail
    const entryDetail = `Imported from Wise (Historical Sync)
Wise ID: ${transactionId}
${referenceNumber ? `Reference: ${referenceNumber}\n` : ''}Confidence: ${classification.confidenceScore}%
Classification: ${classification.reasoning.join(', ')}`;

    // Insert entry
    const entryResult = await client.query(
      `INSERT INTO entries
       (type, category, description, detail, base_amount, total, entry_date, status, employee_id, currency, amount_original)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        entryType,
        entryCategory,
        entryDescription,
        entryDetail,
        amount,
        amount,
        transactionDate.toISOString().split('T')[0],
        'completed',
        classification.employeeId || null,
        currency,
        amount
      ]
    );

    const entryId = entryResult.rows[0].id;

    // Update transaction with entry link
    await client.query(
      `UPDATE wise_transactions
       SET sync_status = 'processed', entry_id = $1, processed_at = CURRENT_TIMESTAMP
       WHERE wise_transaction_id = $2`,
      [entryId, transactionId]
    );

    stats.entriesCreated++;
    stats.byCurrency[currency].amount += (type === 'CREDIT' ? amount : -amount);

    return savedTransaction;

  } catch (error) {
    console.error(`❌ Error processing transaction:`, error.message);
    stats.errors++;

    // Try to mark as failed
    try {
      await WiseTransactionModel.markAsFailed(transaction.referenceNumber, error.message);
    } catch (e) {
      // Ignore if transaction wasn't saved
    }

    return null;
  }
}

// Main execution
async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   🔄 WISE HISTORICAL SYNC STARTING...        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Validate configuration
  if (!WISE_API_TOKEN) {
    console.error('❌ WISE_API_TOKEN not configured');
    process.exit(1);
  }

  if (!WISE_PROFILE_ID) {
    console.error('❌ WISE_PROFILE_ID not configured');
    process.exit(1);
  }

  console.log(`📅 Syncing last ${MONTHS_TO_SYNC} months of transactions`);
  console.log(`🔗 Wise API: ${WISE_API_URL}`);
  console.log(`👤 Profile ID: ${WISE_PROFILE_ID}`);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - MONTHS_TO_SYNC);

  console.log(`📆 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  const client = await pool.getClient();

  try {
    await client.query('BEGIN');

    // Step 1: Get all balance accounts
    const balances = await getBalanceAccounts();

    // Step 2: For each balance, fetch and process transactions
    for (const balance of balances) {
      const transactions = await getTransactionHistory(balance, startDate, endDate);

      if (transactions.length === 0) {
        console.log(`   ⚠️  No transactions found for ${balance.currency}`);
        continue;
      }

      console.log(`   🔄 Processing ${transactions.length} ${balance.currency} transactions...`);

      let processed = 0;
      for (const transaction of transactions) {
        await processTransaction(transaction, balance.currency, client);
        processed++;

        // Progress indicator
        if (processed % 10 === 0) {
          process.stdout.write(`\r   Progress: ${processed}/${transactions.length}`);
        }
      }

      console.log(`\r   ✅ Processed ${processed}/${transactions.length} ${balance.currency} transactions`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Database transaction committed');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ SYNC FAILED - Transaction rolled back');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
  }

  // Print final statistics
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║       📊 SYNC COMPLETE - STATISTICS           ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`📈 Total Transactions Found: ${stats.totalTransactions}`);
  console.log(`✨ New Transactions Imported: ${stats.newTransactions}`);
  console.log(`🔁 Duplicates Skipped: ${stats.duplicates}`);
  console.log(`📝 Entries Created: ${stats.entriesCreated}`);
  console.log(`✅ High Confidence (80%+): ${stats.highConfidence}`);
  console.log(`⚠️  Needs Manual Review: ${stats.needsReview}`);
  console.log(`❌ Errors: ${stats.errors}`);

  console.log('\n💰 By Currency:');
  for (const [currency, data] of Object.entries(stats.byCurrency)) {
    const sign = data.amount >= 0 ? '+' : '';
    console.log(`   ${currency}: ${data.transactions} transactions, ${sign}${data.amount.toFixed(2)} net`);
  }

  console.log('\n✅ Sync completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Check database: SELECT COUNT(*) FROM wise_transactions;');
  console.log('   2. Check entries: SELECT COUNT(*) FROM entries;');
  console.log('   3. Review low-confidence transactions in Wise Sync tab');
  console.log('   4. Recalculate currency balances: POST /api/currency/recalculate');

  process.exit(0);
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Sync interrupted by user');
  console.log('📊 Partial statistics:');
  console.log(`   Transactions found: ${stats.totalTransactions}`);
  console.log(`   Transactions imported: ${stats.newTransactions}`);
  console.log(`   Entries created: ${stats.entriesCreated}`);
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
