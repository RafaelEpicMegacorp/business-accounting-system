#!/usr/bin/env node
/**
 * Fix Wise Entry Data Migration Script
 *
 * This script fixes existing Wise entries that have:
 * 1. "Wise test -" placeholder descriptions instead of real merchant names
 * 2. Wrong status ("completed" instead of "pending" for 20-39% confidence)
 *
 * Usage:
 *   node scripts/fix-wise-entries.js
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const isDryRun = process.argv.includes('--dry-run');

async function fixWiseEntries() {
  console.log('\n🔧 Wise Entry Data Fix Migration');
  console.log('================================\n');

  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Step 1: Find all Wise entries with test descriptions
    console.log('📋 Step 1: Finding entries with "Wise test" descriptions...');

    const testEntriesQuery = `
      SELECT e.id, e.description, e.status, e.detail, e.total, e.currency
      FROM entries e
      WHERE e.description LIKE 'Wise test%'
      ORDER BY e.id DESC
    `;

    const testEntries = await pool.query(testEntriesQuery);
    console.log(`   Found ${testEntries.rows.length} entries with "Wise test" descriptions\n`);

    // Step 2: Find entries with wrong status (completed but low confidence)
    console.log('📋 Step 2: Finding entries with wrong status...');

    const wrongStatusQuery = `
      SELECT e.id, e.description, e.status, e.detail
      FROM entries e
      WHERE e.detail LIKE '%Confidence: 2%'
        AND e.status = 'completed'
      ORDER BY e.id DESC
    `;

    const wrongStatusEntries = await pool.query(wrongStatusQuery);
    console.log(`   Found ${wrongStatusEntries.rows.length} entries with wrong status\n`);

    // Step 3: Extract Wise transaction references and update descriptions
    console.log('📝 Step 3: Extracting real data from wise_transactions...\n');

    let descriptionsFixed = 0;
    let statusFixed = 0;
    let noDataAvailable = 0;

    for (const entry of testEntries.rows) {
      // Extract Wise transaction ID from detail field
      const refMatch = entry.detail.match(/Ref: ([a-f0-9-]+)/);

      if (!refMatch) {
        console.log(`   ⚠️  Entry ${entry.id}: No reference found in detail`);
        noDataAvailable++;
        continue;
      }

      const wiseTransactionId = refMatch[1];

      // Get real data from wise_transactions
      const wiseDataQuery = `
        SELECT description, merchant_name, confidence_score, raw_payload
        FROM wise_transactions
        WHERE wise_transaction_id = $1
      `;

      const wiseData = await pool.query(wiseDataQuery, [wiseTransactionId]);

      if (wiseData.rows.length === 0) {
        console.log(`   ⚠️  Entry ${entry.id}: No matching wise_transaction found`);
        noDataAvailable++;
        continue;
      }

      const wiseTransaction = wiseData.rows[0];
      const confidenceScore = wiseTransaction.confidence_score;

      // Extract description from raw_payload if available
      let newDescription = wiseTransaction.description || wiseTransaction.merchant_name;

      if (!newDescription && wiseTransaction.raw_payload) {
        const payload = wiseTransaction.raw_payload;

        // Try to extract from activity data
        if (payload.activity?.data) {
          const data = payload.activity.data;
          newDescription =
            data.title ||
            data.recipient?.name ||
            data.sender?.name ||
            data.merchant?.name ||
            data.reference ||
            '';
        }

        // Fallback to transfer data
        if (!newDescription && payload.transfer) {
          const transfer = payload.transfer;
          newDescription = transfer.details?.reference || '';
        }
      }

      // If still no description, skip this entry
      if (!newDescription) {
        console.log(`   ⚠️  Entry ${entry.id}: No real data available in wise_transactions`);
        noDataAvailable++;
        continue;
      }

      // Determine correct status based on confidence
      const correctStatus = confidenceScore >= 40 ? 'completed' : 'pending';

      if (isDryRun) {
        console.log(`   🔍 Would update Entry ${entry.id}:`);
        console.log(`      Description: "${entry.description}" → "${newDescription}"`);
        if (entry.status !== correctStatus) {
          console.log(`      Status: "${entry.status}" → "${correctStatus}"`);
        }
        console.log(`      Confidence: ${confidenceScore}%\n`);
      } else {
        // Update the entry
        const updateQuery = `
          UPDATE entries
          SET description = $1, status = $2
          WHERE id = $3
        `;

        await pool.query(updateQuery, [newDescription, correctStatus, entry.id]);

        console.log(`   ✅ Updated Entry ${entry.id}:`);
        console.log(`      Description: "${entry.description}" → "${newDescription}"`);
        if (entry.status !== correctStatus) {
          console.log(`      Status: "${entry.status}" → "${correctStatus}"`);
          statusFixed++;
        }
        console.log(`      Confidence: ${confidenceScore}%\n`);

        descriptionsFixed++;
      }
    }

    // Step 4: Fix remaining entries with wrong status (not caught in Step 3)
    console.log('📝 Step 4: Fixing remaining status issues...\n');

    for (const entry of wrongStatusEntries.rows) {
      // Skip if already processed in Step 3
      if (entry.description.includes('Wise test')) {
        continue;
      }

      // Extract confidence from detail
      const confMatch = entry.detail.match(/Confidence: (\d+)%/);
      if (!confMatch) {
        continue;
      }

      const confidence = parseInt(confMatch[1]);
      const correctStatus = confidence >= 40 ? 'completed' : 'pending';

      if (entry.status !== correctStatus) {
        if (isDryRun) {
          console.log(`   🔍 Would update Entry ${entry.id}:`);
          console.log(`      Status: "${entry.status}" → "${correctStatus}"`);
          console.log(`      Confidence: ${confidence}%\n`);
        } else {
          await pool.query(
            'UPDATE entries SET status = $1 WHERE id = $2',
            [correctStatus, entry.id]
          );

          console.log(`   ✅ Updated Entry ${entry.id}:`);
          console.log(`      Status: "${entry.status}" → "${correctStatus}"`);
          console.log(`      Confidence: ${confidence}%\n`);

          statusFixed++;
        }
      }
    }

    // Summary
    console.log('\n📊 Migration Summary');
    console.log('===================\n');
    console.log(`   Total test entries found: ${testEntries.rows.length}`);
    console.log(`   Descriptions fixed: ${descriptionsFixed}`);
    console.log(`   Status corrections: ${statusFixed}`);
    console.log(`   No data available: ${noDataAvailable}`);

    if (isDryRun) {
      console.log('\n💡 Run without --dry-run to apply these changes');
    } else {
      console.log('\n✅ Migration complete!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
fixWiseEntries();
