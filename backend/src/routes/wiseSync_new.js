// Complete historical sync implementation using Activities API + Transfer API
// This avoids SCA requirements and fetches complete transaction history

const pool = require('../config/database');
const WiseTransactionModel = require('../models/wiseTransactionModel');

/**
 * POST /api/wise/sync
 * Complete historical sync using Activities API + Transfer API
 * Fetches ALL transactions without requiring SCA approval
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

          console.log(`      Type: ${txnType} (${txnType === 'CREDIT' ? 'income' : 'expense'})`);
          console.log(`      Amount: ${amount} ${currency}`);
          console.log(`      Description: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);

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
            merchantName: '',
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

          // Parse primaryAmount (format: "29.99 USD")
          const primaryAmount = activity.primaryAmount || '';
          const amountMatch = primaryAmount.match(/^(-?\d+\.?\d*)\s+([A-Z]{3})$/);

          if (!amountMatch) {
            console.warn(`      ⚠️  Cannot parse primaryAmount: ${primaryAmount}`);
            continue;
          }

          const amount = Math.abs(parseFloat(amountMatch[1]));
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

module.exports = { syncCompleteHistory };
