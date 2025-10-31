// Complete historical sync implementation using Activities API + Transfer API
// This avoids SCA requirements and fetches complete transaction history

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const WiseTransactionModel = require('../models/wiseTransactionModel');
const authMiddleware = require('../middleware/auth');

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

        // Create entry in entries table
        const entryResult = await pool.query(
          `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
 * Complete historical sync using Activities API + Transfer API
 * Fetches ALL transactions without requiring SCA approval
 *
 * Query Parameters:
 *   - mode: "recent" (Activities API only), "transfers" (Transfer API only), "all" (both APIs)
 *
 * API Flow:
 *   1. GET /v1/profiles/{profileId}/activities - Get list of activities (with pagination)
 *   2. For each TRANSFER activity:
 *      GET /v1/transfers/{transferId} - Get full transfer details
 *   3. Classify and import transaction
 */
async function syncCompleteHistory(req, res) {
  console.log('🔄 Complete Wise Historical Sync Started (Activities API + Transfer API)');

  const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
  const WISE_API_URL = process.env.WISE_API_URL || 'https://api.wise.com';
  const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

  if (!WISE_API_TOKEN || !WISE_PROFILE_ID) {
    return res.status(500).json({
      success: false,
      error: 'Wise API not configured. Missing WISE_API_TOKEN or WISE_PROFILE_ID'
    });
  }

  const stats = {
    activitiesProcessed: 0,
    transfersFetched: 0,
    cardPaymentsFetched: 0,
    transactionsFound: 0,
    newTransactions: 0,
    duplicatesSkipped: 0,
    entriesCreated: 0,
    errors: 0,
    errorDetails: [],
    paginationPages: 0
  };

  try {
    // STEP 1: Fetch all activities with pagination
    console.log('\n📋 STEP 1: Fetching activities from Wise Activities API...');

    // Calculate 1 year ago as start date
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const since = oneYearAgo.toISOString();

    console.log(`   Date Range: ${since} to ${new Date().toISOString()}`);

    const allActivities = [];
    let cursor = null;
    let pageCount = 0;

    do {
      pageCount++;
      const url = cursor
        ? `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities?cursor=${cursor}&size=100`
        : `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities?since=${since}&size=100`;

      console.log(`   Fetching page ${pageCount}${cursor ? ' (cursor: ' + cursor.substring(0, 20) + '...)' : ''}...`);

      const activitiesResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!activitiesResponse.ok) {
        const errorText = await activitiesResponse.text();
        throw new Error(`Wise API error fetching activities: ${activitiesResponse.status} ${errorText}`);
      }

      const data = await activitiesResponse.json();
      const activities = data.activities || [];

      allActivities.push(...activities);
      console.log(`   ✓ Fetched ${activities.length} activities (Total: ${allActivities.length})`);

      cursor = data.nextCursor;
      stats.paginationPages = pageCount;

    } while (cursor);

    console.log(`\n✓ Total activities fetched: ${allActivities.length} across ${pageCount} pages`);
    stats.activitiesProcessed = allActivities.length;

    // STEP 2: Process each activity
    console.log('\n📋 STEP 2: Processing activities and fetching transfer details...');

    for (const activity of allActivities) {
      try {
        // Process TRANSFER activities
        if (activity.type === 'TRANSFER' && activity.resource?.id) {
          const transferId = activity.resource.id;
          console.log(`\n   📝 Processing TRANSFER: ${transferId}`);
          console.log(`      Title: ${activity.title || 'N/A'}`);
          console.log(`      Amount: ${activity.primaryAmount || 'N/A'}`);

          // STEP 3: Fetch full transfer details
          console.log(`      Fetching transfer details...`);

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
            const errorText = await transferResponse.text();
            throw new Error(`Transfer API error for ${transferId}: ${transferResponse.status} ${errorText}`);
          }

          const transfer = await transferResponse.json();
          stats.transfersFetched++;

          // STEP 4: Determine transaction type (CREDIT vs DEBIT)
          // If sourceValue is present, it's outgoing (DEBIT/expense)
          // If only targetValue is present, it's incoming (CREDIT/income)
          const txnType = transfer.sourceValue ? 'DEBIT' : 'CREDIT';
          const amount = Math.abs(parseFloat(transfer.sourceValue || transfer.targetValue));
          const currency = transfer.sourceCurrency || transfer.targetCurrency;
          const description = transfer.details?.reference || '';
          const referenceNumber = transfer.customerTransactionId || `TRANSFER-${transfer.id}`;
          const transactionDate = transfer.created;
          const transactionId = transfer.customerTransactionId || `TRANSFER-${transfer.id}`;

          // Extract merchant/counterparty name
          // For DEBIT (outgoing), targetName is the recipient/merchant
          // For CREDIT (incoming), sourceName is the sender
          const merchantName = txnType === 'DEBIT'
            ? (transfer.details?.recipient?.name || transfer.targetName || '')
            : (transfer.details?.sender?.name || transfer.sourceName || '');

          console.log(`      Type: ${txnType} (${txnType === 'CREDIT' ? 'income' : 'expense'})`);
          console.log(`      Amount: ${amount} ${currency}`);
          console.log(`      Description: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);
          console.log(`      Merchant: ${merchantName.substring(0, 40)}${merchantName.length > 40 ? '...' : ''}`);

          // Check for duplicates
          const existing = await WiseTransactionModel.exists(transactionId);
          if (existing) {
            stats.duplicatesSkipped++;
            console.log(`      ⏭️  Skipping duplicate: ${transactionId}`);
            continue;
          }

          stats.transactionsFound++;

          // STEP 5: Store transaction in database
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
            merchantName: merchantName || '',
            referenceNumber,
            transactionDate,
            valueDate: transactionDate,
            syncStatus: 'processed',
            classifiedCategory: null,
            matchedEmployeeId: null,
            confidenceScore: null,
            needsReview: false,
            rawPayload: transfer
          });

          stats.newTransactions++;
          console.log(`      ✅ Transaction stored in database`);

          // STEP 6: Create entry immediately
          const entryType = txnType === 'CREDIT' ? 'income' : 'expense';
          const category = entryType === 'income' ? 'other_income' : 'other_expenses';

          const entryResult = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
              entryType,
              category,
              description || 'Wise transaction',
              `Imported from Wise (Ref: ${referenceNumber})`,
              amount,
              amount,
              transactionDate.split('T')[0],
              'completed',
              currency,
              amount,
              transactionId
            ]
          );

          // Link entry to transaction
          await WiseTransactionModel.updateStatus(transactionId, {
            entryId: entryResult.rows[0].id,
            syncStatus: 'processed'
          });

          stats.entriesCreated++;
          console.log(`      ✅ Entry created (ID: ${entryResult.rows[0].id})`);

        } else if (activity.type === 'CARD_PAYMENT' && activity.resource?.id) {
          // Process CARD_PAYMENT activities
          stats.cardPaymentsFetched++;

          const cardTransactionId = activity.resource.id;
          console.log(`\n   💳 Processing CARD_PAYMENT: ${cardTransactionId}`);
          console.log(`      Title: ${activity.title || 'N/A'}`);
          console.log(`      Amount: ${activity.primaryAmount || 'N/A'}`);

          // Parse primaryAmount (format: "29.99 USD" or "1,939.19 USD")
          const primaryAmount = activity.primaryAmount || '';
          // Remove commas from amount before parsing
          const amountMatch = primaryAmount.match(/^(-?[\d,]+\.?\d*)\s+([A-Z]{3})$/);

          if (!amountMatch) {
            console.warn(`      ⚠️  Cannot parse primaryAmount: ${primaryAmount}`);
            continue;
          }

          // Remove commas and parse as float
          const amount = Math.abs(parseFloat(amountMatch[1].replace(/,/g, '')));
          const currency = amountMatch[2];

          // Card payments are always DEBIT (expenses)
          const txnType = 'DEBIT';
          const entryType = 'expense';

          // Clean HTML tags from title
          const description = (activity.title || 'Card payment').replace(/<[^>]*>/g, '').trim();

          // Transaction details
          const transactionDate = activity.createdOn;
          const transactionId = `CARD_PAYMENT-${cardTransactionId}`;

          console.log(`      Type: ${txnType} (expense)`);
          console.log(`      Amount: ${amount} ${currency}`);
          console.log(`      Description: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);

          // Check for duplicate
          const existing = await WiseTransactionModel.exists(transactionId);
          if (existing) {
            stats.duplicatesSkipped++;
            console.log(`      ⏭️  Skipping duplicate: ${transactionId}`);
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
          console.log(`      ✅ Transaction stored in database`);

          // Create entry in entries table
          const entryResult = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
              entryType,
              'other_expenses',
              description,
              `Imported from Wise (Card Payment)`,
              amount,
              amount,
              transactionDate.split('T')[0],
              'completed',
              currency,
              amount,
              transactionId
            ]
          );

          // Link entry to transaction
          await WiseTransactionModel.updateStatus(transactionId, {
            entryId: entryResult.rows[0].id,
            syncStatus: 'processed'
          });

          stats.entriesCreated++;
          console.log(`      ✅ Entry created (ID: ${entryResult.rows[0].id})`);

        } else {
          console.log(`   ⏭️  Skipping activity type: ${activity.type}`);
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

    // STEP 3: Fetch and update currency balances
    console.log('\n📋 STEP 3: Updating currency balances...');

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
      throw new Error(`Wise API error fetching balances: ${balancesResponse.status} ${errorText}`);
    }

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

    // Final summary
    console.log('\n📊 SYNC COMPLETE - SUMMARY:');
    console.log(`   Activities Processed: ${stats.activitiesProcessed}`);
    console.log(`   Pagination Pages: ${stats.paginationPages}`);
    console.log(`   Transfers Fetched: ${stats.transfersFetched}`);
    console.log(`   Card Payments Fetched: ${stats.cardPaymentsFetched}`);
    console.log(`   Total Transactions Found: ${stats.transactionsFound}`);
    console.log(`   New Transactions: ${stats.newTransactions}`);
    console.log(`   Duplicates Skipped: ${stats.duplicatesSkipped}`);
    console.log(`   Entries Created: ${stats.entriesCreated}`);
    console.log(`   Errors: ${stats.errors}`);

    res.json({
      success: true,
      message: `✅ Wise sync completed successfully`,
      stats: {
        ...stats,
        dateRange: {
          since: since,
          until: new Date().toISOString()
        },
        breakdown: {
          transfers: stats.transfersFetched,
          cardPayments: stats.cardPaymentsFetched
        }
      }
    });

  } catch (error) {
    console.error('\n❌ SYNC FAILED:', error.message);
    console.error('Stack:', error.stack);

    res.status(500).json({
      success: false,
      error: error.message,
      stats
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

          // Extract merchant/counterparty name
          const merchantName = txnType === 'DEBIT'
            ? (transfer.details?.recipient?.name || transfer.targetName || '')
            : (transfer.details?.sender?.name || transfer.sourceName || '');

          // Check for duplicates
          const existing = await WiseTransactionModel.exists(transactionId);
          if (existing) {
            stats.duplicatesSkipped++;
            continue;
          }

          stats.transactionsFound++;

          // Store transaction in database
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
            merchantName: merchantName || '',
            referenceNumber: transactionId,
            transactionDate,
            valueDate: transactionDate,
            syncStatus: 'processed',
            classifiedCategory: null,
            matchedEmployeeId: null,
            confidenceScore: null,
            needsReview: false,
            rawPayload: transfer
          });

          stats.newTransactions++;

          // Create entry
          const entryType = txnType === 'CREDIT' ? 'income' : 'expense';
          const category = entryType === 'income' ? 'other_income' : 'other_expenses';

          const entryResult = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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

          // Create entry in entries table
          const entryResult = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
