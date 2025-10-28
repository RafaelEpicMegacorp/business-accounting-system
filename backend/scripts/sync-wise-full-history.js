#!/usr/bin/env node

/**
 * Wise Full History Sync Script
 *
 * Fetches transaction history from Wise using Activities API + Transfer API
 * and imports them into the accounting system.
 *
 * NOTE: Uses Activities API instead of Balance Statement API to avoid SCA requirements.
 *
 * Usage:
 *   node scripts/sync-wise-full-history.js [--dry-run]
 *
 * Options:
 *   --dry-run: Show what would be imported without actually importing
 *
 * API Flow:
 *   1. GET /v1/profiles/{profileId}/activities - Get list of activities
 *   2. For each TRANSFER activity:
 *      GET /v1/transfers/{transferId} - Get full transfer details
 *   3. Classify and import transaction
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
 * Fetch activities from profile
 */
async function getActivities() {
  console.log('\n📋 Fetching activities from Wise...');

  const url = `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WISE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch activities: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const activityCount = data.activities?.length || 0;

  console.log(`✓ Found ${activityCount} activity(ies)`);

  return data.activities || [];
}

/**
 * Fetch transfer details by ID
 */
async function getTransferDetails(transferId) {
  const url = `${WISE_API_URL}/v1/transfers/${transferId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WISE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch transfer ${transferId}: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Process a single transfer from Wise API
 */
async function processTransfer(transfer) {
  try {
    const transactionId = transfer.customerTransactionId || `TRANSFER-${transfer.id}`;

    // Check for duplicates
    const existing = await WiseTransactionModel.exists(transactionId);
    if (existing) {
      stats.duplicateTransactions++;
      console.log(`  ⏭️  Skipping duplicate: ${transactionId}`);
      return { action: 'skipped', reason: 'duplicate' };
    }

    if (isDryRun) {
      stats.newTransactions++;
      console.log(`  [DRY RUN] Would import: ${transactionId} - ${transfer.details?.reference || 'No reference'} (${transfer.sourceValue} ${transfer.sourceCurrency})`);
      return { action: 'dry-run' };
    }

    // Extract transfer details
    const amount = Math.abs(parseFloat(transfer.sourceValue || transfer.targetValue));
    const currency = transfer.sourceCurrency || transfer.targetCurrency;
    const description = transfer.details?.reference || '';
    const merchantName = ''; // Not available in transfer API
    const referenceNumber = transfer.customerTransactionId || `TRANSFER-${transfer.id}`;
    const transactionDate = transfer.created;

    // Determine if this is a credit or debit (incoming or outgoing)
    // If sourceValue is present, it's outgoing (DEBIT)
    // If only targetValue is present, it's incoming (CREDIT)
    const type = transfer.sourceValue ? 'DEBIT' : 'CREDIT';

    // Prepare transaction data for classification
    const transactionData = {
      type,
      amount,
      currency,
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
      wiseResourceId: transfer.id.toString(),
      profileId: WISE_PROFILE_ID,
      accountId: transfer.sourceAccount || transfer.targetAccount,
      type,
      state: transfer.status || 'completed',
      amount,
      currency,
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
      rawPayload: transfer
    });

    stats.newTransactions++;
    console.log(`  ✅ Imported: ${transactionId}`);
    console.log(`     Description: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);
    console.log(`     Amount: ${amount} ${currency}`);
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
  console.log('🚀 Wise Activity Sync (via Activities API)');
  console.log('=' .repeat(60));
  console.log(`   Profile ID: ${WISE_PROFILE_ID}`);
  console.log(`   Method: Activities API + Transfer API`);
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
    // Fetch activities from Wise
    const activities = await getActivities();

    if (!activities || activities.length === 0) {
      console.log('\nℹ️  No activities found');
      console.log('💡 This could mean:');
      console.log('   - No recent transfers on this account');
      console.log('   - Activities API only shows certain activity types');
      console.log('   - Try making a test transfer to verify webhook integration');
      return;
    }

    stats.totalTransactions = activities.length;

    // Process each activity
    for (const activity of activities) {
      try {
        console.log(`\n📝 Processing activity: ${activity.type}`);
        console.log(`   Title: ${activity.title}`);
        console.log(`   Description: ${activity.description}`);
        console.log(`   Amount: ${activity.primaryAmount}`);

        // Only process TRANSFER activities
        if (activity.type === 'TRANSFER' && activity.resource?.id) {
          const transferId = activity.resource.id;

          console.log(`   Fetching transfer details for ID: ${transferId}...`);

          // Fetch full transfer details
          const transfer = await getTransferDetails(transferId);

          // Process the transfer
          await processTransfer(transfer);

        } else {
          console.log(`   ⏭️  Skipping non-transfer activity: ${activity.type}`);
        }

      } catch (error) {
        stats.errors++;
        console.error(`\n❌ Error processing activity ${activity.id}:`, error.message);
      }
    }

    // Print final statistics
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(2);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 Sync Complete');
    console.log('=' .repeat(60));
    console.log(`   Activities processed: ${stats.totalTransactions}`);
    console.log(`   New transactions imported: ${stats.newTransactions}`);
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
