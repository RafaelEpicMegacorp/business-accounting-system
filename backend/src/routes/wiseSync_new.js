// New complete historical sync implementation using Balance Statements API
// This replaces the old Activities API approach

const pool = require('../config/database');
const WiseTransactionModel = require('../models/wiseTransactionModel');

/**
 * POST /api/wise/sync
 * Complete historical sync using Balance Statements API
 * Fetches ALL transactions for each currency from account creation to now
 */
async function syncCompleteHistory(req, res) {
  console.log('🔄 Complete Wise Historical Sync Started');

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
    balancesProcessed: 0,
    transactionsFound: 0,
    newTransactions: 0,
    duplicatesSkipped: 0,
    entriesCreated: 0,
    errors: 0,
    errorDetails: [],
    currencyBreakdown: {}
  };

  try {
    // STEP 1: Fetch all currency balances
    console.log('\n📋 STEP 1: Fetching currency balances...');
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
    console.log(`✓ Found ${balances.length} currency balances`);

    // Initialize stats for all currencies
    balances.forEach(balance => {
      const currency = balance.currency;
      stats.currencyBreakdown[currency] = {
        transactionsFound: 0,
        newTransactions: 0,
        duplicatesSkipped: 0,
        entriesCreated: 0,
        errors: 0,
        currentBalance: balance.amount.value
      };
    });

    // STEP 2: Fetch ALL activities (not filtered by currency)
    console.log('\n📋 STEP 2: Fetching ALL activities from Wise API...');

    // Find the earliest account creation date
    const earliestDate = new Date(Math.min(...balances.map(b => new Date(b.creationTime))));
    const now = new Date();
    const createdDateStart = earliestDate.toISOString();
    const createdDateEnd = now.toISOString();

    console.log(`   Date range: ${createdDateStart.split('T')[0]} to ${createdDateEnd.split('T')[0]}`);
    console.log(`   Full start: ${createdDateStart}`);
    console.log(`   Full end: ${createdDateEnd}`);

    // Fetch activities with pagination support
    let allActivities = [];
    let offset = 0;
    const limit = 100; // Fetch 100 at a time
    let hasMore = true;

    while (hasMore) {
      const activitiesUrl = `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities?` +
        `createdDateStart=${createdDateStart}&` +
        `createdDateEnd=${createdDateEnd}&` +
        `limit=${limit}&` +
        `offset=${offset}`;

      console.log(`   Requesting: ${activitiesUrl.substring(0, 100)}...`);

      const activitiesResponse = await fetch(
        activitiesUrl,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${WISE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`   Response status: ${activitiesResponse.status}`);

      if (!activitiesResponse.ok) {
        const errorText = await activitiesResponse.text();
        throw new Error(`Activities API error: ${activitiesResponse.status} ${errorText}`);
      }

      const activitiesData = await activitiesResponse.json();
      const activities = activitiesData.activities || [];

      if (activities.length === 0) {
        hasMore = false;
        break;
      }

      allActivities = allActivities.concat(activities);
      offset += limit;

      // If we got less than limit, we've reached the end
      if (activities.length < limit) {
        hasMore = false;
      }

      console.log(`   Fetched ${activities.length} activities (offset: ${offset - limit}), ${allActivities.length} total...`);
    }

    console.log(`   ✓ Total activities fetched: ${allActivities.length}\n`);

    // STEP 3: Process activities and group by currency
    console.log('📋 STEP 3: Processing activities...\n');

    const validActivityTypes = ['TRANSFER', 'CARD_PAYMENT', 'CARD_CHECK', 'CONVERSION'];

    for (const activity of allActivities) {
      try {
        // Skip non-transaction activities
        if (!validActivityTypes.includes(activity.type) || !activity.resource?.id) {
          continue;
        }

        // Extract currency from primaryAmount
        let activityCurrency = 'USD';
        let amount = 0;
        if (activity.primaryAmount) {
          const amountMatch = activity.primaryAmount.match(/([\d,]+\.?\d*)\s*([A-Z]{3})/);
          if (amountMatch) {
            amount = Math.abs(parseFloat(amountMatch[1].replace(/,/g, '')));
            activityCurrency = amountMatch[2];
          }
        }

        // Skip if amount is zero (e.g., cancelled transactions)
        if (amount === 0) {
          console.log(`   ⊘ Skipping zero-amount transaction: ${activity.type}-${activity.resource?.id}`);
          continue;
        }

        // Skip if currency not in our balances
        if (!stats.currencyBreakdown[activityCurrency]) {
          continue;
        }

        stats.currencyBreakdown[activityCurrency].transactionsFound++;
        stats.transactionsFound++;

        const resourceId = activity.resource.id;
        const transactionId = `${activity.type}-${resourceId}`;

        // Check for duplicates
        const existing = await WiseTransactionModel.exists(transactionId);
        if (existing) {
          stats.duplicatesSkipped++;
          stats.currencyBreakdown[activityCurrency].duplicatesSkipped++;
          continue;
        }

        // Determine transaction direction from description field
        // Wise Activities API uses phrases like "Spent by you", "Sent by you" for expenses
        // and "To you", "Received" for income
        const activityDescription = activity.description || '';
        const description = activityDescription.toLowerCase();

        // Check for income indicators first (less common)
        const isIncome = description.includes('to you') ||
                         description.includes('received') ||
                         description.includes('from');

        // Check for expense indicators
        const isExpense = description.includes('by you') ||
                          description.includes('spent by you') ||
                          description.includes('sent by you');

        // Default to DEBIT (expense) if no clear indicator
        // This is safer as most transactions are expenses
        const txnType = isIncome ? 'CREDIT' : 'DEBIT';

        // Extract merchant name from title (remove HTML tags)
        let merchantName = activity.title || '';
        merchantName = merchantName.replace(/<strong>|<\/strong>|<positive>|<\/positive>|<negative>|<\/negative>/g, '').trim();

        // Transaction date from createdOn
        const transactionDate = activity.createdOn || new Date().toISOString();

        // Find the balance ID for this currency
        const balance = balances.find(b => b.currency === activityCurrency);
        const balanceId = balance ? balance.id : null;

        // Store transaction in wise_transactions table
        await WiseTransactionModel.create({
          wiseTransactionId: transactionId,
          wiseResourceId: resourceId.toString(),
          profileId: WISE_PROFILE_ID,
          accountId: balanceId,
          type: txnType,
          state: activity.status || 'completed',
          amount,
          currency: activityCurrency,
          description: merchantName,
          merchantName,
          referenceNumber: transactionId,
          transactionDate,
          valueDate: transactionDate,
          syncStatus: 'processed',
          classifiedCategory: null,
          matchedEmployeeId: null,
          confidenceScore: null,
          needsReview: false,
          rawPayload: activity
        });

        stats.newTransactions++;
        stats.currencyBreakdown[activityCurrency].newTransactions++;

        // Create entry immediately
        const entryType = txnType === 'CREDIT' ? 'income' : 'expense';
        const category = entryType === 'income' ? 'other_income' : 'other_expenses';

        const entryResult = await pool.query(
          `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, currency, amount_original, wise_transaction_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            entryType,
            category,
            merchantName || 'Wise transaction',
            `Imported from Wise (Ref: ${transactionId})`,
            amount,
            amount,
            transactionDate.split('T')[0],
            'completed',
            activityCurrency,
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
        stats.currencyBreakdown[activityCurrency].entriesCreated++;

        console.log(`   ✓ ${activityCurrency} ${entryType} ${amount} - ${merchantName.substring(0, 40)}...`);

      } catch (error) {
        stats.errors++;
        const activityCurrency = activity.primaryAmount?.match(/([A-Z]{3})/)?.[1] || 'UNKNOWN';
        if (stats.currencyBreakdown[activityCurrency]) {
          stats.currencyBreakdown[activityCurrency].errors++;
        }
        stats.errorDetails.push({
          activity: activity.resource?.id,
          error: error.message
        });
        console.error(`   ❌ Error processing activity ${activity.resource?.id}:`, error.message);
      }
    }

    // Remove the per-currency loop - we've processed everything above
    stats.balancesProcessed = balances.length;

    // STEP 4: Update currency_balances table
    console.log('\n🔄 STEP 4: Updating currency balances...');
    for (const balance of balances) {
      await pool.query(`
        INSERT INTO currency_balances (currency, balance, last_updated)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (currency)
        DO UPDATE SET balance = $2, last_updated = CURRENT_TIMESTAMP
      `, [balance.currency, balance.amount.value]);

      console.log(`   ✓ ${balance.currency}: ${balance.amount.value}`);
    }

    // Continue with final summary...
    const transactions = allActivities; // For compatibility

    // Final summary
    console.log('\n📊 SYNC COMPLETE - SUMMARY:');
    console.log(`   Balances Processed: ${stats.balancesProcessed}`);
    console.log(`   Total Transactions Found: ${stats.transactionsFound}`);
    console.log(`   New Transactions: ${stats.newTransactions}`);
    console.log(`   Duplicates Skipped: ${stats.duplicatesSkipped}`);
    console.log(`   Entries Created: ${stats.entriesCreated}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log('\n   Per-Currency Breakdown:');
    Object.keys(stats.currencyBreakdown).forEach(currency => {
      const cb = stats.currencyBreakdown[currency];
      console.log(`     ${currency}: ${cb.newTransactions} new, ${cb.transactionsFound} total, Balance: ${cb.currentBalance}`);
    });

    res.json({
      success: true,
      message: `Complete historical sync finished: ${stats.newTransactions} new transactions imported`,
      stats
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
