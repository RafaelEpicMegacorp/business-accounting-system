// Complete historical sync implementation using Balance Statement API
// This captures both incoming (CREDIT) and outgoing (DEBIT) transactions

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const WiseTransactionModel = require('../models/wiseTransactionModel');
const authMiddleware = require('../middleware/auth');
const wiseTransactionProcessor = require('../services/wiseTransactionProcessor');

/**
 * Get metadata value from wise_sync_metadata table
 * @param {string} key - Metadata key
 * @returns {string|null} Metadata value
 */
async function getMetadata(key) {
  const result = await pool.query(
    'SELECT value FROM wise_sync_metadata WHERE key = $1',
    [key]
  );
  return result.rows.length > 0 ? result.rows[0].value : null;
}

/**
 * Set metadata value in wise_sync_metadata table
 * @param {string} key - Metadata key
 * @param {string} value - Metadata value
 */
async function setMetadata(key, value) {
  await pool.query(
    `INSERT INTO wise_sync_metadata (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key)
     DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

/**
 * Extract complete recipient/sender details from transfer object
 * @param {object} transferDetails - Full transfer object from Wise API
 * @param {string} txnType - Transaction type ('DEBIT' or 'CREDIT')
 * @returns {object} Structured recipient details
 */
function extractRecipientDetails(transferDetails, txnType) {
  // For DEBIT (outgoing), get recipient details
  // For CREDIT (incoming), get sender details
  const party = txnType === 'DEBIT'
    ? (transferDetails.details?.recipient || {})
    : (transferDetails.details?.sender || {});

  return {
    name: party.name || transferDetails.targetName || transferDetails.sourceName || '',
    accountNumber: party.accountNumber || party.iban || party.accountHolderName || '',
    bankCode: party.bankCode || party.bic || party.sortCode || party.swiftCode || '',
    address: {
      city: party.address?.city || party.city || '',
      country: party.address?.country || party.country || '',
      postCode: party.address?.postCode || party.postCode || '',
      firstLine: party.address?.firstLine || ''
    },
    email: party.email || '',
    legalType: party.legalType || 'PERSON' // PERSON or BUSINESS
  };
}

// Cache for exchange rates to avoid repeated API calls
const exchangeRateCache = new Map();

/**
 * Get exchange rate to USD for a given currency
 * Uses exchangerate-api.com with caching to avoid repeated calls
 * @param {string} currency - Source currency code
 * @returns {object} { rate: number, amountUsd: number } for converting to USD
 */
async function getExchangeRateToUSD(currency, amount) {
  // USD is already USD
  if (currency === 'USD') {
    return { rate: 1, amountUsd: amount };
  }

  // Check cache (valid for 1 hour)
  const cacheKey = currency;
  const cached = exchangeRateCache.get(cacheKey);
  if (cached && cached.timestamp > Date.now() - 3600000) {
    return { rate: cached.rate, amountUsd: amount * cached.rate };
  }

  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
    if (!response.ok) {
      console.warn(`Failed to get exchange rate for ${currency}, using 1:1`);
      return { rate: 1, amountUsd: amount };
    }
    const data = await response.json();
    const rate = data.rates.USD || 1;

    // Cache the rate
    exchangeRateCache.set(cacheKey, { rate, timestamp: Date.now() });

    return { rate, amountUsd: amount * rate };
  } catch (error) {
    console.warn(`Exchange rate API error for ${currency}:`, error.message);
    return { rate: 1, amountUsd: amount };
  }
}

/**
 * Get all balance accounts for the profile
 * @param {object} config - API configuration
 * @returns {Array} Array of balance objects with id, currency, amount
 */
async function getProfileBalances(config) {
  const { WISE_API_TOKEN, WISE_API_URL, WISE_PROFILE_ID } = config;

  console.log('   Fetching profile balances...');

  const response = await fetch(
    `${WISE_API_URL}/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wise API error fetching balances: ${response.status} ${errorText}`);
  }

  const balances = await response.json();
  console.log(`   ✓ Found ${balances.length} balance accounts`);

  return balances.map(b => ({
    id: b.id,
    currency: b.currency,
    amount: b.amount.value
  }));
}

/**
 * Fetch balance statement for a specific balance account
 * @param {number} balanceId - Balance account ID
 * @param {string} currency - Currency code
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @param {object} config - API configuration
 * @returns {Array} Array of transactions
 */
async function fetchBalanceStatement(balanceId, currency, startDate, endDate, config) {
  const { WISE_API_TOKEN, WISE_API_URL, WISE_PROFILE_ID } = config;

  const url = `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/balance-statements/${balanceId}/statement.json`;
  const params = new URLSearchParams({
    currency: currency,
    intervalStart: startDate,
    intervalEnd: endDate,
    type: 'COMPACT'
  });

  console.log(`      Fetching ${currency} statement (${startDate.split('T')[0]} to ${endDate.split('T')[0]})...`);

  const response = await fetch(`${url}?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${WISE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Check for SCA requirement
    if (response.status === 403) {
      console.log(`      ⚠️  ${currency}: SCA required or access denied`);
      return [];
    }
    throw new Error(`Balance Statement API error: ${response.status} ${errorText}`);
  }

  const statement = await response.json();
  const transactions = statement.transactions || [];
  console.log(`      ✓ ${currency}: ${transactions.length} transactions`);

  return transactions;
}

/**
 * Process a transaction from Balance Statement API
 * @param {object} txn - Transaction from statement
 * @param {string} currency - Currency code
 * @param {object} config - API configuration
 * @param {object} stats - Stats object to update
 */
async function processStatementTransaction(txn, currency, config, stats) {
  const { WISE_PROFILE_ID } = config;

  // Extract transaction details
  const transactionId = txn.referenceNumber;
  const txnType = txn.type; // CREDIT or DEBIT
  const amount = Math.abs(parseFloat(txn.amount?.value || 0));
  const description = txn.details?.description || '';
  const senderName = txn.details?.senderName || '';
  const recipientName = txn.details?.recipientName || '';
  const transactionDate = txn.date;

  // Determine entry type based on transaction type
  const entryType = txnType === 'CREDIT' ? 'income' : 'expense';

  // Check for duplicates
  const existing = await WiseTransactionModel.exists(transactionId);
  if (existing) {
    stats.duplicatesSkipped++;
    return { action: 'duplicate', transactionId };
  }

  stats.transactionsFound++;

  // Determine category based on transaction type and description
  let category;
  if (txnType === 'CREDIT') {
    // Income categories
    if (description.toLowerCase().includes('interest')) {
      category = 'Interest';
    } else if (description.toLowerCase().includes('refund')) {
      category = 'Refund';
    } else {
      category = 'Client Payment'; // Default for incoming money
    }
  } else {
    // Expense - check if it's a transfer between accounts
    if (description.toLowerCase().includes('transfer to') ||
        description.toLowerCase().includes('transferred to') ||
        description.toLowerCase().includes('conversion') ||
        description.toLowerCase().includes('balance conversion')) {
      category = 'Transfers';
    } else {
      category = 'Other'; // Will be classified by processor
    }
  }

  // Get exchange rate to USD for proper comparison
  const { rate: exchangeRate, amountUsd } = await getExchangeRateToUSD(currency, amount);

  // Store in wise_transactions table
  await WiseTransactionModel.create({
    wiseTransactionId: transactionId,
    wiseResourceId: transactionId,
    profileId: WISE_PROFILE_ID,
    accountId: null,
    type: txnType,
    state: 'completed',
    amount,
    currency,
    description,
    merchantName: txnType === 'CREDIT' ? senderName : recipientName,
    referenceNumber: transactionId,
    transactionDate,
    valueDate: transactionDate,
    syncStatus: 'processed',
    classifiedCategory: category,
    matchedEmployeeId: null,
    confidenceScore: 80,
    needsReview: false,
    rawPayload: txn
  });

  stats.newTransactions++;

  // Create entry in entries table with USD equivalent for comparison
  const entryResult = await pool.query(
    `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, amount_usd, exchange_rate, wise_transaction_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      entryType,
      category,
      description || (txnType === 'CREDIT' ? `Payment from ${senderName}` : `Payment to ${recipientName}`),
      `Imported from Wise Balance Statement (Ref: ${transactionId})`,
      amount,
      amount,
      transactionDate.split('T')[0],
      'completed',
      currency,
      amount,
      amountUsd,
      exchangeRate,
      transactionId
    ]
  );

  // Link entry to transaction
  await WiseTransactionModel.updateStatus(transactionId, {
    entryId: entryResult.rows[0].id,
    syncStatus: 'processed'
  });

  stats.entriesCreated++;

  const icon = txnType === 'CREDIT' ? '💵' : '💸';
  console.log(`         ${icon} ${txnType}: ${amount} ${currency} - ${description.substring(0, 40)}${description.length > 40 ? '...' : ''} [${category}]`);

  return { action: 'imported', transactionId, entryId: entryResult.rows[0].id };
}

/**
 * Sync from Balance Statement API - captures both CREDIT and DEBIT transactions
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @param {object} config - API configuration
 * @returns {object} Stats object
 */
async function syncFromBalanceStatements(startDate, endDate, config) {
  console.log('\n📋 Syncing from Balance Statement API (captures CREDIT + DEBIT)...');
  console.log(`   Date range: ${startDate.split('T')[0]} to ${endDate.split('T')[0]}`);

  const stats = {
    balancesProcessed: 0,
    transactionsFound: 0,
    newTransactions: 0,
    duplicatesSkipped: 0,
    entriesCreated: 0,
    creditCount: 0,
    debitCount: 0,
    errors: 0
  };

  try {
    // Get all balance accounts
    const balances = await getProfileBalances(config);

    // Process each balance account
    for (const balance of balances) {
      console.log(`\n   💰 Processing ${balance.currency} balance (ID: ${balance.id})...`);
      stats.balancesProcessed++;

      try {
        // Fetch statement for this balance
        const transactions = await fetchBalanceStatement(
          balance.id,
          balance.currency,
          startDate,
          endDate,
          config
        );

        // Process each transaction
        for (const txn of transactions) {
          try {
            const result = await processStatementTransaction(txn, balance.currency, config, stats);

            if (result.action === 'imported') {
              if (txn.type === 'CREDIT') stats.creditCount++;
              if (txn.type === 'DEBIT') stats.debitCount++;
            }
          } catch (txnError) {
            stats.errors++;
            console.error(`         ❌ Error: ${txnError.message}`);
          }
        }

      } catch (balanceError) {
        stats.errors++;
        console.error(`      ❌ Error fetching ${balance.currency} statement: ${balanceError.message}`);
      }
    }

    console.log('\n   📊 Balance Statement Sync Summary:');
    console.log(`      Balances processed: ${stats.balancesProcessed}`);
    console.log(`      Transactions found: ${stats.transactionsFound}`);
    console.log(`      New transactions: ${stats.newTransactions} (${stats.creditCount} CREDIT, ${stats.debitCount} DEBIT)`);
    console.log(`      Duplicates skipped: ${stats.duplicatesSkipped}`);
    console.log(`      Entries created: ${stats.entriesCreated}`);
    console.log(`      Errors: ${stats.errors}`);

  } catch (error) {
    console.error('   ❌ Balance Statement sync failed:', error.message);
    throw error;
  }

  return stats;
}

/**
 * Fetch historical transfers from Wise Transfer API
 * Transfer API has no date limitations and can fetch complete history
 * @param {string} startDate - ISO date string (e.g., "2024-08-01T00:00:00.000Z")
 * @param {string} endDate - ISO date string
 * @param {object} config - API configuration (token, URL, profile)
 * @returns {Object} Stats object with counts
 */
async function syncTransfersFromAPI(startDate, endDate, config) {
  const { WISE_API_TOKEN, WISE_API_URL, WISE_PROFILE_ID } = config;
  const stats = {
    transfersProcessed: 0,
    imported: 0,
    duplicatesSkipped: 0,
    errors: 0
  };

  let offset = 0;
  const limit = 100;
  let hasMore = true;

  console.log(`\n📅 Syncing transfers from ${startDate.split('T')[0]} to ${endDate.split('T')[0]}`);

  while (hasMore) {
    try {
      const url = `${WISE_API_URL}/v1/transfers`;
      const params = new URLSearchParams({
        profile: WISE_PROFILE_ID,
        createdDateStart: startDate,
        createdDateEnd: endDate,
        limit: limit.toString(),
        offset: offset.toString()
      });

      console.log(`   📄 Fetching page ${Math.floor(offset / limit) + 1} (offset: ${offset})...`);

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transfer API error: ${response.status} - ${errorText}`);
      }

      const transfers = await response.json();

      console.log(`   ✓ Retrieved ${transfers.length} transfers`);

      if (transfers.length === 0) {
        hasMore = false;
        continue;
      }

      // Process each transfer
      for (const transfer of transfers) {
        stats.transfersProcessed++;

        // Determine transaction type from transfer structure
        // sourceValue present = outgoing money (DEBIT/expense)
        // only targetValue = incoming money (CREDIT/income)
        const hasSourceValue = transfer.sourceValue && transfer.sourceValue > 0;
        const txnType = hasSourceValue ? 'DEBIT' : 'CREDIT';
        const entryType = txnType === 'CREDIT' ? 'income' : 'expense';

        // Extract transaction details
        const amount = Math.abs(hasSourceValue ? transfer.sourceValue : transfer.targetValue);
        const currency = hasSourceValue ? transfer.sourceCurrency : transfer.targetCurrency;
        const description = transfer.details?.reference || transfer.reference || `Transfer ${transfer.id}`;
        const transactionDate = transfer.created;
        const transactionId = transfer.customerTransactionId || `TRANSFER-${transfer.id}`;

        console.log(`      💰 ${transactionId}: ${txnType} ${amount} ${currency}`);

        // Check for duplicates
        const existing = await WiseTransactionModel.exists(transactionId);
        if (existing) {
          stats.duplicatesSkipped++;
          console.log(`      ⏭️  Duplicate - skipping`);
          continue;
        }

        // Store in wise_transactions table
        await WiseTransactionModel.create({
          wiseTransactionId: transactionId,
          wiseResourceId: transfer.id.toString(),
          profileId: WISE_PROFILE_ID,
          accountId: (hasSourceValue ? transfer.sourceAccount : transfer.targetAccount) || null,
          type: txnType,
          state: transfer.status || 'completed',
          amount: amount,
          currency: currency,
          description: description,
          merchantName: '',
          referenceNumber: transactionId,
          transactionDate: transactionDate,
          valueDate: transactionDate,
          syncStatus: 'processed',
          classifiedCategory: entryType === 'income' ? 'other_income' : 'other_expenses',
          matchedEmployeeId: null,
          confidenceScore: 80,
          needsReview: false,
          rawPayload: transfer
        });

        // Get exchange rate to USD for proper comparison
        const { rate: transferExchangeRate, amountUsd: transferAmountUsd } = await getExchangeRateToUSD(currency, amount);

        // Create entry in entries table with USD equivalent
        const entryResult = await pool.query(
          `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, amount_usd, exchange_rate, wise_transaction_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            entryType,
            entryType === 'income' ? 'other_income' : 'other_expenses',
            description,
            `Imported from Wise Transfer API (Ref: ${transactionId})`,
            amount,
            amount,
            transactionDate.split('T')[0],
            'completed',
            currency,
            amount,
            transferAmountUsd,
            transferExchangeRate,
            transactionId
          ]
        );

        // Link entry to transaction
        await WiseTransactionModel.updateStatus(transactionId, {
          entryId: entryResult.rows[0].id,
          syncStatus: 'processed'
        });

        stats.imported++;
        console.log(`      ✅ Imported`);
      }

      // Check if more pages exist
      hasMore = transfers.length === limit;
      offset += limit;

    } catch (error) {
      console.error(`   ❌ Error fetching transfers at offset ${offset}:`, error.message);
      stats.errors++;
      hasMore = false; // Stop on error
    }
  }

  return stats;
}

/**
 * POST /api/wise/sync
 * Complete historical sync using Balance Statement API
 * Fetches ALL transactions (both CREDIT and DEBIT) from all currency balances
 *
 * This approach captures:
 * - Incoming payments (CREDIT) → type = 'income'
 * - Outgoing payments (DEBIT) → type = 'expense'
 * - Inter-account transfers → category = 'Transfers'
 */
async function syncCompleteHistory(req, res) {
  console.log('🔄 Complete Wise Historical Sync Started (Balance Statement API)');

  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';
  const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

  if (!WISE_API_TOKEN || !WISE_PROFILE_ID) {
    return res.status(500).json({
      success: false,
      error: 'Wise API not configured. Missing WISE_API_TOKEN or WISE_PROFILE_ID'
    });
  }

  const config = { WISE_API_TOKEN, WISE_API_URL, WISE_PROFILE_ID };

  try {
    // Calculate date range - 1 year of history
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString();
    const endDate = new Date().toISOString();

    // STEP 1: Sync from Balance Statement API (captures both CREDIT and DEBIT)
    const balanceStats = await syncFromBalanceStatements(startDate, endDate, config);

    // STEP 2: Update currency balances from Wise API
    console.log('\n📋 STEP 2: Updating currency balances...');

    const balancesResponse = await fetch(
      `${WISE_API_URL}/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (balancesResponse.ok) {
      const balances = await balancesResponse.json();

      for (const balance of balances) {
        await pool.query(`
          INSERT INTO currency_balances (currency, balance, last_updated)
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (currency)
          DO UPDATE SET balance = $2, last_updated = CURRENT_TIMESTAMP
        `, [balance.currency, balance.amount.value]);

        console.log(`   ✓ ${balance.currency}: ${balance.amount.value}`);
      }
    }

    // Build currency breakdown for response
    const currencyBreakdown = {};
    try {
      const balanceResult = await pool.query(`
        SELECT currency, balance FROM currency_balances ORDER BY currency
      `);
      for (const row of balanceResult.rows) {
        currencyBreakdown[row.currency] = {
          currentBalance: parseFloat(row.balance),
          newTransactions: 0 // We don't track per-currency in balance statement sync
        };
      }
    } catch (e) {
      // Ignore errors getting breakdown
    }

    // Final summary
    console.log('\n📊 SYNC COMPLETE - SUMMARY:');
    console.log(`   Balances Processed: ${balanceStats.balancesProcessed}`);
    console.log(`   Transactions Found: ${balanceStats.transactionsFound}`);
    console.log(`   New Transactions: ${balanceStats.newTransactions}`);
    console.log(`   - CREDIT (Income): ${balanceStats.creditCount}`);
    console.log(`   - DEBIT (Expense): ${balanceStats.debitCount}`);
    console.log(`   Duplicates Skipped: ${balanceStats.duplicatesSkipped}`);
    console.log(`   Entries Created: ${balanceStats.entriesCreated}`);
    console.log(`   Errors: ${balanceStats.errors}`);

    res.json({
      success: true,
      message: `✅ Wise sync completed successfully`,
      stats: {
        newTransactions: balanceStats.newTransactions,
        duplicatesSkipped: balanceStats.duplicatesSkipped,
        entriesCreated: balanceStats.entriesCreated,
        creditCount: balanceStats.creditCount,
        debitCount: balanceStats.debitCount,
        errors: balanceStats.errors,
        dateRange: {
          since: startDate,
          until: endDate
        },
        currencyBreakdown
      }
    });

  } catch (error) {
    console.error('\n❌ SYNC FAILED:', error.message);
    console.error('Stack:', error.stack);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Incremental sync - fetches only new transactions since last sync
 * Uses Activities API with date range filtering
 * @param {number} lookbackHours - Safety margin to fetch slightly older transactions (default: 12)
 * @returns {Object} Sync statistics
 */
async function runIncrementalSync(lookbackHours = 12) {
  console.log('🔄 Starting incremental Wise sync...');

  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';
  const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

  if (!WISE_API_TOKEN || !WISE_PROFILE_ID) {
    throw new Error('Wise API not configured. Missing WISE_API_TOKEN or WISE_PROFILE_ID');
  }

  const stats = {
    activitiesProcessed: 0,
    transactionsFound: 0,
    newTransactions: 0,
    duplicatesSkipped: 0,
    entriesCreated: 0,
    errors: 0,
    errorDetails: [],
    dateRange: { since: null, until: null }
  };

  try {
    // Get last sync timestamp
    const lastSyncTimestamp = await getMetadata('last_sync_timestamp');

    // Calculate date range with lookback buffer
    const now = new Date();
    let since;

    if (lastSyncTimestamp) {
      const lastSync = new Date(lastSyncTimestamp);
      since = new Date(lastSync.getTime() - (lookbackHours * 60 * 60 * 1000));
      console.log(`   Last sync: ${lastSync.toISOString()}`);
      console.log(`   Fetching since: ${since.toISOString()} (${lookbackHours}h lookback buffer)`);
    } else {
      // First sync - go back 7 days
      since = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      console.log(`   First sync - fetching last 7 days since: ${since.toISOString()}`);
    }

    stats.dateRange.since = since.toISOString();
    stats.dateRange.until = now.toISOString();

    // Fetch activities from Wise API with pagination
    const allActivities = [];
    let cursor = null;
    let pageCount = 0;

    do {
      pageCount++;
      const url = cursor
        ? `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities?cursor=${cursor}&size=100`
        : `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities?since=${since.toISOString()}&size=100`;

      console.log(`   Fetching page ${pageCount}...`);

      const activitiesResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!activitiesResponse.ok) {
        const errorText = await activitiesResponse.text();
        throw new Error(`Wise API error: ${activitiesResponse.status} ${errorText}`);
      }

      const data = await activitiesResponse.json();
      const activities = data.activities || [];

      allActivities.push(...activities);
      cursor = data.nextCursor;

      console.log(`   ✓ Fetched ${activities.length} activities (Total: ${allActivities.length})`);

    } while (cursor);

    stats.activitiesProcessed = allActivities.length;

    // Process each activity
    console.log(`\n📋 Processing ${allActivities.length} activities...`);

    for (const activity of allActivities) {
      try {
        // Process TRANSFER activities
        if (activity.type === 'TRANSFER' && activity.resource?.id) {
          const transferId = activity.resource.id;

          // Fetch full transfer details
          const transferResponse = await fetch(
            `${WISE_API_URL}/v1/transfers/${transferId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${WISE_API_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!transferResponse.ok) {
            throw new Error(`Transfer API error for ${transferId}: ${transferResponse.status}`);
          }

          const transfer = await transferResponse.json();

          // Determine transaction type
          const txnType = transfer.sourceValue ? 'DEBIT' : 'CREDIT';
          const amount = Math.abs(parseFloat(transfer.sourceValue || transfer.targetValue));
          const currency = transfer.sourceCurrency || transfer.targetCurrency;
          const description = transfer.details?.reference || '';
          const transactionId = transfer.customerTransactionId || `TRANSFER-${transfer.id}`;
          const transactionDate = transfer.created;

          // Extract complete recipient details, fees, and rates
          const recipientDetails = extractRecipientDetails(transfer, txnType);
          const transferFee = parseFloat(transfer.fee || 0);
          const exchangeRate = transfer.rate ? parseFloat(transfer.rate) : null;

          // Check for duplicates
          const existing = await WiseTransactionModel.exists(transactionId);
          if (existing) {
            stats.duplicatesSkipped++;
            continue;
          }

          stats.transactionsFound++;

          // Store transaction in database with enhanced details
          await WiseTransactionModel.create({
            wiseTransactionId: transactionId,
            wiseResourceId: transfer.id.toString(),
            profileId: WISE_PROFILE_ID,
            accountId: transfer.sourceAccount || transfer.targetAccount,
            type: txnType,
            state: transfer.status || 'completed',
            amount,
            currency,
            description,
            merchantName: recipientDetails.name,
            referenceNumber: transactionId,
            transactionDate,
            valueDate: transactionDate,
            syncStatus: 'processed',
            classifiedCategory: null,
            matchedEmployeeId: null,
            confidenceScore: null,
            needsReview: false,
            rawPayload: transfer,
            transferFee: transferFee,
            transferExchangeRate: exchangeRate,
            recipientDetails: recipientDetails
          });

          stats.newTransactions++;

          // Create entry
          const entryType = txnType === 'CREDIT' ? 'income' : 'expense';
          const category = entryType === 'income' ? 'other_income' : 'other_expenses';

          // Get exchange rate to USD for proper comparison
          const { rate: usdExchangeRate, amountUsd: usdAmount } = await getExchangeRateToUSD(currency, amount);

          const entryResult = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, amount_usd, exchange_rate, wise_transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id`,
            [
              entryType,
              category,
              description || 'Wise transaction',
              `Imported from Wise (Ref: ${transactionId})`,
              amount,
              amount,
              transactionDate.split('T')[0],
              'completed',
              currency,
              amount,
              usdAmount,
              usdExchangeRate,
              transactionId
            ]
          );

          // Link entry to transaction
          await WiseTransactionModel.updateStatus(transactionId, {
            entryId: entryResult.rows[0].id,
            syncStatus: 'processed'
          });

          stats.entriesCreated++;

        } else if (activity.type === 'CARD_PAYMENT' && activity.resource?.id) {
          // Process CARD_PAYMENT activities
          const cardTransactionId = activity.resource.id;
          const primaryAmount = activity.primaryAmount || '';
          const amountMatch = primaryAmount.match(/^(-?[\d,]+\.?\d*)\s+([A-Z]{3})$/);

          if (!amountMatch) {
            console.warn(`      ⚠️  Cannot parse primaryAmount: ${primaryAmount}`);
            continue;
          }

          const amount = Math.abs(parseFloat(amountMatch[1].replace(/,/g, '')));
          const currency = amountMatch[2];
          const txnType = 'DEBIT';
          const description = (activity.title || 'Card payment').replace(/<[^>]*>/g, '').trim();
          const transactionDate = activity.createdOn;
          const transactionId = `CARD_PAYMENT-${cardTransactionId}`;

          // Check for duplicate
          const existing = await WiseTransactionModel.exists(transactionId);
          if (existing) {
            stats.duplicatesSkipped++;
            continue;
          }

          stats.transactionsFound++;

          // Store in wise_transactions table
          await WiseTransactionModel.create({
            wiseTransactionId: transactionId,
            wiseResourceId: cardTransactionId.toString(),
            profileId: WISE_PROFILE_ID,
            accountId: null,
            type: txnType,
            state: 'completed',
            amount,
            currency,
            description,
            merchantName: '',
            referenceNumber: transactionId,
            transactionDate,
            valueDate: transactionDate,
            syncStatus: 'processed',
            classifiedCategory: 'other_expenses',
            matchedEmployeeId: null,
            confidenceScore: 100,
            needsReview: false,
            rawPayload: activity
          });

          stats.newTransactions++;

          // Get exchange rate to USD for proper comparison
          const { rate: cardExchangeRate, amountUsd: cardAmountUsd } = await getExchangeRateToUSD(currency, amount);

          // Create entry in entries table with USD equivalent
          const entryResult = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, amount_usd, exchange_rate, wise_transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id`,
            [
              'expense',
              'other_expenses',
              description,
              `Imported from Wise (Card Payment)`,
              amount,
              amount,
              transactionDate.split('T')[0],
              'completed',
              currency,
              amount,
              cardAmountUsd,
              cardExchangeRate,
              transactionId
            ]
          );

          // Link entry to transaction
          await WiseTransactionModel.updateStatus(transactionId, {
            entryId: entryResult.rows[0].id,
            syncStatus: 'processed'
          });

          stats.entriesCreated++;
        }

      } catch (error) {
        stats.errors++;
        stats.errorDetails.push({
          activity: activity.type,
          resourceId: activity.resource?.id,
          error: error.message
        });
        console.error(`   ❌ Error processing activity:`, error.message);
      }
    }

    // Update currency balances from Wise API
    console.log('\n💰 Updating currency balances from Wise...');

    try {
      const balancesResponse = await fetch(
        `${WISE_API_URL}/v4/profiles/${WISE_PROFILE_ID}/balances?types=STANDARD`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${WISE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!balancesResponse.ok) {
        const errorText = await balancesResponse.text();
        console.error(`   ⚠️  Failed to fetch balances: ${balancesResponse.status} ${errorText}`);
      } else {
        const balances = await balancesResponse.json();

        for (const balance of balances) {
          await pool.query(`
            INSERT INTO currency_balances (currency, balance, last_updated)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (currency)
            DO UPDATE SET balance = $2, last_updated = CURRENT_TIMESTAMP
          `, [balance.currency, balance.amount.value]);

          console.log(`   ✓ ${balance.currency}: ${balance.amount.value}`);
        }

        console.log('✓ Currency balances updated successfully');
      }
    } catch (balanceError) {
      console.error('   ⚠️  Error updating balances:', balanceError.message);
      // Don't fail the sync if balance update fails
    }

    // Update last sync timestamp
    await setMetadata('last_sync_timestamp', now.toISOString());

    // Increment sync count
    const syncCount = parseInt(await getMetadata('sync_count') || '0') + 1;
    await setMetadata('sync_count', syncCount.toString());

    // Store stats
    await setMetadata('last_sync_stats', JSON.stringify(stats));

    console.log('\n📊 Incremental sync complete:');
    console.log(`   Activities processed: ${stats.activitiesProcessed}`);
    console.log(`   New transactions: ${stats.newTransactions}`);
    console.log(`   Duplicates skipped: ${stats.duplicatesSkipped}`);
    console.log(`   Entries created: ${stats.entriesCreated}`);
    console.log(`   Errors: ${stats.errors}`);

    return stats;

  } catch (error) {
    console.error('❌ Incremental sync failed:', error.message);
    throw error;
  }
}

/**
 * POST /api/wise/sync/manual - Manual sync trigger endpoint
 */
router.post('/sync/manual', authMiddleware, async (req, res) => {
  try {
    const stats = await runIncrementalSync();
    res.json({
      success: true,
      message: 'Manual sync completed',
      stats
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      error: 'sync_failed',
      message: error.message
    });
  }
});

/**
 * POST /api/wise/sync - Complete historical sync (existing endpoint)
 */
router.post('/sync', authMiddleware, syncCompleteHistory);

/**
 * POST /api/wise/backfill-amount-usd - Backfill amount_usd for existing entries
 * Run once to update entries that don't have amount_usd set
 */
router.post('/backfill-amount-usd', authMiddleware, async (req, res) => {
  try {
    console.log('Starting backfill of amount_usd for existing entries...');

    // Get all entries without amount_usd
    const result = await pool.query(`
      SELECT id, total, currency
      FROM entries
      WHERE amount_usd IS NULL
      ORDER BY id
    `);

    console.log(`Found ${result.rows.length} entries without amount_usd`);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'All entries already have amount_usd set. Nothing to do.',
        updated: 0
      });
    }

    let updated = 0;
    let errors = 0;

    for (const entry of result.rows) {
      try {
        const currency = entry.currency || 'USD';
        const amount = parseFloat(entry.total);
        const { rate, amountUsd } = await getExchangeRateToUSD(currency, amount);

        await pool.query(`
          UPDATE entries
          SET amount_usd = $1, exchange_rate = $2
          WHERE id = $3
        `, [amountUsd, rate, entry.id]);

        updated++;
      } catch (error) {
        errors++;
        console.error(`Error updating entry ${entry.id}:`, error.message);
      }
    }

    console.log(`Backfill complete! Updated: ${updated}, Errors: ${errors}`);

    res.json({
      success: true,
      message: 'Backfill complete',
      total: result.rows.length,
      updated,
      errors
    });
  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({
      success: false,
      error: 'backfill_failed',
      message: error.message
    });
  }
});

/**
 * Export sync function for cron job use
 */
async function runScheduledSync() {
  console.log('\n🕐 [CRON] Running scheduled Wise sync...');

  // Check if sync is enabled
  const syncEnabled = await getMetadata('sync_enabled');
  if (syncEnabled === 'false') {
    console.log('⊘ Sync disabled in metadata - skipping');
    return { success: false, message: 'Sync disabled' };
  }

  try {
    const stats = await runIncrementalSync();
    return { success: true, stats };
  } catch (error) {
    console.error('❌ [CRON] Scheduled sync failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = router;
module.exports.runScheduledSync = runScheduledSync;
module.exports.runIncrementalSync = runIncrementalSync;
module.exports.syncCompleteHistory = syncCompleteHistory;
