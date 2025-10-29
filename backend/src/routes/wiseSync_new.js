// Complete historical sync implementation using Balance Statements API
// This replaces the old Activities API approach which only returned recent transactions

const pool = require('../config/database');
const WiseTransactionModel = require('../models/wiseTransactionModel');

/**
 * POST /api/wise/sync
 * Complete historical sync using Balance Statements API
 * Fetches ALL transactions for each currency from account creation to now
 *
 * IMPORTANT: This endpoint requires SCA (Strong Customer Authentication)
 * If you receive a 403 error, you must approve the request in your Wise app/website
 * SCA approval is required every 90 days for security
 */
async function syncCompleteHistory(req, res) {
  console.log('🔄 Complete Wise Historical Sync Started (Balance Statements API)');

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
    currencyBreakdown: {},
    scaRequired: false
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
        currentBalance: balance.amount.value,
        balanceId: balance.id
      };
    });

    // STEP 2: Fetch transaction statements for EACH currency balance
    console.log('\n📋 STEP 2: Fetching transaction statements from Wise Balance Statements API...');
    console.log('   ⚠️  Note: This may require SCA (Strong Customer Authentication) approval');

    // Find the earliest account creation date
    const earliestDate = new Date(Math.min(...balances.map(b => new Date(b.creationTime))));
    const now = new Date();

    // Balance Statements API supports up to 469 days of history
    // Format: YYYY-MM-DDTHH:MM:SS.SSSZ
    const intervalStart = earliestDate.toISOString();
    const intervalEnd = now.toISOString();

    console.log(`   Date range: ${intervalStart.split('T')[0]} to ${intervalEnd.split('T')[0]}`);
    console.log(`   Total days: ${Math.ceil((now - earliestDate) / (1000 * 60 * 60 * 24))} days\n`);

    // Process each currency balance separately
    for (const balance of balances) {
      const currency = balance.currency;
      const balanceId = balance.id;

      console.log(`\n   💱 Processing ${currency} (Balance ID: ${balanceId})...`);

      try {
        // Balance Statements API endpoint
        const statementUrl = `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/balance-statements/${balanceId}/statement.json?` +
          `currency=${currency}&` +
          `intervalStart=${intervalStart}&` +
          `intervalEnd=${intervalEnd}&` +
          `type=COMPACT`;

        console.log(`      Fetching: ${statementUrl.substring(0, 120)}...`);

        const statementResponse = await fetch(
          statementUrl,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${WISE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Check for SCA requirement (403 with x-2fa-approval header)
        if (statementResponse.status === 403) {
          const approval2FA = statementResponse.headers.get('x-2fa-approval');
          const approvalResult = statementResponse.headers.get('x-2fa-approval-result');

          if (approval2FA) {
            stats.scaRequired = true;
            console.log(`\n   🔐 SCA AUTHENTICATION REQUIRED`);
            console.log(`      Approval ID: ${approval2FA}`);
            console.log(`      Status: ${approvalResult || 'PENDING'}`);

            return res.status(403).json({
              success: false,
              requiresSCA: true,
              approvalId: approval2FA,
              approvalResult: approvalResult,
              message: '🔐 Strong Customer Authentication (SCA) Required',
              instructions: [
                '1. Open your Wise mobile app or go to wise.com',
                '2. Look for a pending authorization request',
                '3. Review and approve the "Balance Statements API" access',
                '4. Once approved, click "Sync Wise History" button again',
                '',
                '⚠️  Note: SCA approval is required every 90 days for security',
                '✅ This is a one-time setup - future syncs will work automatically'
              ],
              currency: currency,
              balanceId: balanceId,
              stats
            });
          }
        }

        if (!statementResponse.ok) {
          const errorText = await statementResponse.text();
          throw new Error(`Balance Statement API error for ${currency}: ${statementResponse.status} ${errorText}`);
        }

        const statement = await statementResponse.json();
        const transactions = statement.transactions || [];

        console.log(`      ✓ Fetched ${transactions.length} transactions for ${currency}`);

        stats.currencyBreakdown[currency].transactionsFound = transactions.length;
        stats.transactionsFound += transactions.length;

        // STEP 3: Process transactions for this currency
        for (const transaction of transactions) {
          try {
            // Skip if no reference number (invalid transaction)
            if (!transaction.referenceNumber) {
              console.log(`      ⊘ Skipping transaction without reference number`);
              continue;
            }

            // Extract amount and determine transaction type
            const amount = Math.abs(transaction.amount.value);
            const txnCurrency = transaction.amount.currency;

            // Skip zero-amount transactions
            if (amount === 0) {
              console.log(`      ⊘ Skipping zero-amount transaction: ${transaction.referenceNumber}`);
              continue;
            }

            // Generate unique transaction ID
            const transactionId = `STATEMENT-${transaction.referenceNumber}`;

            // Check for duplicates
            const existing = await WiseTransactionModel.exists(transactionId);
            if (existing) {
              stats.duplicatesSkipped++;
              stats.currencyBreakdown[currency].duplicatesSkipped++;
              continue;
            }

            // Determine transaction direction
            // Positive amount = CREDIT (money received / income)
            // Negative amount = DEBIT (money sent / expense)
            const txnType = transaction.amount.value > 0 ? 'CREDIT' : 'DEBIT';

            // Extract merchant/description from details
            let merchantName = transaction.details?.description ||
                              transaction.details?.merchantName ||
                              transaction.details?.paymentReference ||
                              'Wise transaction';

            // Clean up merchant name (remove extra whitespace)
            merchantName = merchantName.trim();

            // Transaction date
            const transactionDate = transaction.date || new Date().toISOString();

            // Store transaction in wise_transactions table
            await WiseTransactionModel.create({
              wiseTransactionId: transactionId,
              wiseResourceId: transaction.referenceNumber,
              profileId: WISE_PROFILE_ID,
              accountId: balanceId,
              type: txnType,
              state: 'completed',
              amount,
              currency: txnCurrency,
              description: merchantName,
              merchantName,
              referenceNumber: transaction.referenceNumber,
              transactionDate,
              valueDate: transactionDate,
              syncStatus: 'processed',
              classifiedCategory: null,
              matchedEmployeeId: null,
              confidenceScore: null,
              needsReview: false,
              rawPayload: transaction
            });

            stats.newTransactions++;
            stats.currencyBreakdown[currency].newTransactions++;

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
                `Imported from Wise (Ref: ${transaction.referenceNumber})`,
                amount,
                amount,
                transactionDate.split('T')[0],
                'completed',
                txnCurrency,
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
            stats.currencyBreakdown[currency].entriesCreated++;

            console.log(`      ✓ ${txnCurrency} ${entryType} ${amount} - ${merchantName.substring(0, 40)}${merchantName.length > 40 ? '...' : ''}`);

          } catch (error) {
            stats.errors++;
            stats.currencyBreakdown[currency].errors++;
            stats.errorDetails.push({
              currency: currency,
              transaction: transaction.referenceNumber,
              error: error.message
            });
            console.error(`      ❌ Error processing transaction ${transaction.referenceNumber}:`, error.message);
          }
        }

        stats.balancesProcessed++;

      } catch (error) {
        stats.errors++;
        stats.currencyBreakdown[currency].errors++;
        stats.errorDetails.push({
          currency: currency,
          balanceId: balanceId,
          error: error.message
        });
        console.error(`   ❌ Error fetching statement for ${currency}:`, error.message);
      }
    }

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

    // Final summary
    console.log('\n📊 SYNC COMPLETE - SUMMARY:');
    console.log(`   Balances Processed: ${stats.balancesProcessed}/${balances.length}`);
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
      message: `Complete historical sync finished: ${stats.newTransactions} new transactions imported from ${stats.balancesProcessed} currencies`,
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
