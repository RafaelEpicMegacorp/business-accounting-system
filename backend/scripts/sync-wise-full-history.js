#!/usr/bin/env node

/**
 * Wise Full History Sync Script
 *
 * Fetches complete transaction history from Wise for all currency balances
 * and imports them into the accounting system.
 *
 * Usage:
 *   node scripts/sync-wise-full-history.js [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Options:
 *   --from: Start date (default: 6 months ago)
 *   --to: End date (default: today)
 *   --dry-run: Show what would be imported without actually importing
 */

require('dotenv').config();
const { Pool } = require('pg');
const wiseClassifier = require('../src/services/wiseClassifier');
const WiseTransactionModel = require('../src/models/wiseTransactionModel');
const EntryModel = require('../src/models/entryModel');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Wise API configuration
const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

// Parse command line arguments
const args = process.argv.slice(2);
const getArgValue = (arg) => {
  const index = args.indexOf(arg);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const isDryRun = args.includes('--dry-run');
const fromDate = getArgValue('--from') || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 6 months ago
const toDate = getArgValue('--to') || new Date().toISOString().split('T')[0]; // Today

// Statistics tracking
const stats = {
  balances: 0,
  totalTransactions: 0,
  newTransactions: 0,
  duplicateTransactions: 0,
  entriesCreated: 0,
  errors: 0,
  startTime: Date.now()
};

/**
 * Fetch all balances for the profile
 */
async function getBalances() {
  console.log('\n📊 Fetching balances from Wise...');

  const response = await fetch(`${WISE_API_URL}/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WISE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch balances: ${response.status} ${errorText}`);
  }

  const balances = await response.json();
  console.log(`✓ Found ${balances.length} balance(s)`);

  balances.forEach(balance => {
    console.log(`  - ${balance.currency}: ${balance.amount.value} (Balance ID: ${balance.id})`);
  });

  return balances;
}

/**
 * Fetch statement for a specific balance
 */
async function getBalanceStatement(balanceId, currency, intervalStart, intervalEnd) {
  console.log(`\n💳 Fetching ${currency} transactions from ${intervalStart} to ${intervalEnd}...`);

  const url = `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/balance-statements/${balanceId}/statement.json?currency=${currency}&intervalStart=${intervalStart}T00:00:00.000Z&intervalEnd=${intervalEnd}T23:59:59.999Z&type=COMPACT`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WISE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch statement for ${currency}: ${response.status} ${errorText}`);
  }

  const statement = await response.json();
  const transactionCount = statement.transactions?.length || 0;

  console.log(`✓ Found ${transactionCount} transaction(s)`);

  return statement;
}

/**
 * Process a single transaction
 */
async function processTransaction(transaction, currency) {
  try {
    const transactionId = transaction.referenceNumber;

    // Check for duplicates
    const existing = await WiseTransactionModel.exists(transactionId);
    if (existing) {
      stats.duplicateTransactions++;
      console.log(`  ⏭️  Skipping duplicate: ${transactionId}`);
      return { action: 'skipped', reason: 'duplicate' };
    }

    if (isDryRun) {
      stats.newTransactions++;
      console.log(`  [DRY RUN] Would import: ${transactionId} - ${transaction.details?.description || 'No description'} (${transaction.amount.value} ${transaction.amount.currency})`);
      return { action: 'dry-run' };
    }

    // Extract transaction details
    const amount = Math.abs(parseFloat(transaction.amount.value));
    const description = transaction.details?.description || '';
    const merchantName = transaction.details?.senderName || transaction.details?.recipientName || '';
    const referenceNumber = transaction.referenceNumber;
    const transactionDate = transaction.date;

    // Prepare transaction data for classification
    const transactionData = {
      type: transaction.type, // CREDIT or DEBIT
      amount,
      currency: transaction.amount.currency,
      description,
      merchantName,
      referenceNumber,
      transactionDate
    };

    // Classify transaction
    const classification = await wiseClassifier.classifyTransaction(transactionData);

    // Store transaction in database
    const savedTransaction = await WiseTransactionModel.create({
      wiseTransactionId: transactionId,
      wiseResourceId: null,
      profileId: WISE_PROFILE_ID,
      accountId: null,
      type: transaction.type,
      state: 'completed',
      amount,
      currency: transaction.amount.currency,
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
      rawPayload: transaction
    });

    stats.newTransactions++;
    console.log(`  ✅ Imported: ${transactionId}`);
    console.log(`     Description: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);
    console.log(`     Amount: ${transaction.amount.value} ${transaction.amount.currency}`);
    console.log(`     Category: ${classification.category} (${classification.confidenceScore}% confidence)`);

    // Auto-create entry if high confidence
    if (!classification.needsReview && classification.confidenceScore >= 80) {
      await autoCreateEntry(savedTransaction, classification);
      stats.entriesCreated++;
      console.log(`     ✓ Entry auto-created`);
    } else {
      console.log(`     ⚠️  Needs manual review`);
    }

    return { action: 'imported', transaction: savedTransaction };

  } catch (error) {
    stats.errors++;
    console.error(`  ❌ Error processing transaction:`, error.message);
    return { action: 'error', error: error.message };
  }
}

/**
 * Auto-create accounting entry for high-confidence transaction
 */
async function autoCreateEntry(transaction, classification) {
  try {
    const entryType = transaction.type === 'CREDIT' ? 'income' : 'expense';
    const category = classification.category;

    // Get exchange rate to USD if needed
    let amountUsd = transaction.amount;
    let exchangeRate = 1;

    if (transaction.currency !== 'USD') {
      // Fetch current exchange rate (you may want to use historical rate)
      const rateResponse = await fetch(`https://api.exchangerate-api.com/v4/latest/${transaction.currency}`);
      const rateData = await rateResponse.json();
      exchangeRate = rateData.rates.USD;
      amountUsd = transaction.amount * exchangeRate;
    }

    const entryData = {
      type: entryType,
      category: category,
      description: transaction.description || `${transaction.merchantName || 'Wise transaction'}`,
      detail: `Auto-imported from Wise (Ref: ${transaction.referenceNumber})`,
      base_amount: transaction.amount,
      total: transaction.amount,
      entry_date: new Date(transaction.transactionDate).toISOString().split('T')[0],
      status: 'completed',
      currency: transaction.currency,
      amount_original: transaction.amount,
      amount_usd: amountUsd,
      exchange_rate: exchangeRate,
      employee_id: classification.employeeId || null
    };

    const entry = await EntryModel.create(entryData);

    // Update transaction with entry ID
    await WiseTransactionModel.updateEntryId(transaction.wiseTransactionId, entry.id);

    return entry;

  } catch (error) {
    console.error('Error creating entry:', error);
    throw error;
  }
}

/**
 * Main sync function
 */
async function syncFullHistory() {
  console.log('🚀 Wise Full History Sync');
  console.log('=' .repeat(60));
  console.log(`   Profile ID: ${WISE_PROFILE_ID}`);
  console.log(`   Date Range: ${fromDate} to ${toDate}`);
  console.log(`   Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE IMPORT'}`);
  console.log('=' .repeat(60));

  // Validate environment
  if (!WISE_API_TOKEN) {
    throw new Error('WISE_API_TOKEN environment variable not set');
  }
  if (!WISE_PROFILE_ID) {
    throw new Error('WISE_PROFILE_ID environment variable not set');
  }

  try {
    // Get all balances
    const balances = await getBalances();
    stats.balances = balances.length;

    // Process each balance
    for (const balance of balances) {
      const currency = balance.currency;
      const balanceId = balance.id;

      try {
        // Fetch statement for this balance
        const statement = await getBalanceStatement(balanceId, currency, fromDate, toDate);

        if (!statement.transactions || statement.transactions.length === 0) {
          console.log(`  ℹ️  No transactions found for ${currency}`);
          continue;
        }

        stats.totalTransactions += statement.transactions.length;

        // Process each transaction
        for (const transaction of statement.transactions) {
          await processTransaction(transaction, currency);
        }

      } catch (error) {
        stats.errors++;
        console.error(`\n❌ Error processing ${currency} balance:`, error.message);
      }
    }

    // Print final statistics
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(2);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 Sync Complete');
    console.log('=' .repeat(60));
    console.log(`   Balances processed: ${stats.balances}`);
    console.log(`   Total transactions found: ${stats.totalTransactions}`);
    console.log(`   New transactions: ${stats.newTransactions}`);
    console.log(`   Duplicates skipped: ${stats.duplicateTransactions}`);
    console.log(`   Entries created: ${stats.entriesCreated}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Time elapsed: ${elapsed}s`);
    console.log('=' .repeat(60));

    if (isDryRun) {
      console.log('\n💡 This was a dry run. Run without --dry-run to actually import.');
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the sync
syncFullHistory().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
