#!/usr/bin/env node
/**
 * Cleanup Wise Test Data Script
 *
 * This script removes test/bad data from Wise sync before re-syncing with fixed code.
 * It deletes:
 * 1. All entries with "Wise test" descriptions
 * 2. All wise_transactions records
 * 3. Recalculates currency balances
 *
 * Usage:
 *   node scripts/cleanup-wise-test-data.js
 *
 * Options:
 *   --dry-run    Show what would be deleted without making changes
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const isDryRun = process.argv.includes('--dry-run');

async function cleanupWiseTestData() {
  console.log('\n🧹 Wise Test Data Cleanup');
  console.log('=========================\n');

  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Count entries to be deleted
    console.log('📋 Step 1: Analyzing entries to delete...');

    const countQuery = `
      SELECT COUNT(*) as count
      FROM entries
      WHERE description LIKE 'Wise test%'
         OR detail LIKE '%Auto-imported from Wise%'
    `;

    const countResult = await client.query(countQuery);
    const entriesToDelete = parseInt(countResult.rows[0].count);

    console.log(`   Found ${entriesToDelete} Wise-imported entries\n`);

    // Step 2: Count wise_transactions to be deleted
    console.log('📋 Step 2: Analyzing wise_transactions to delete...');

    const wiseCountQuery = 'SELECT COUNT(*) as count FROM wise_transactions';
    const wiseCountResult = await client.query(wiseCountQuery);
    const wiseTransactionsToDelete = parseInt(wiseCountResult.rows[0].count);

    console.log(`   Found ${wiseTransactionsToDelete} wise_transactions records\n`);

    if (isDryRun) {
      console.log('🔍 DRY RUN - Would delete:');
      console.log(`   - ${entriesToDelete} entries`);
      console.log(`   - ${wiseTransactionsToDelete} wise_transactions\n`);
      console.log('💡 Run without --dry-run to delete this data\n');

      await client.query('ROLLBACK');
      return;
    }

    // Step 3: Delete entries
    console.log('🗑️  Step 3: Deleting Wise-imported entries...');

    const deleteEntriesQuery = `
      DELETE FROM entries
      WHERE description LIKE 'Wise test%'
         OR detail LIKE '%Auto-imported from Wise%'
      RETURNING id
    `;

    const deletedEntries = await client.query(deleteEntriesQuery);
    console.log(`   ✅ Deleted ${deletedEntries.rowCount} entries\n`);

    // Step 4: Delete wise_transactions
    console.log('🗑️  Step 4: Deleting wise_transactions...');

    const deleteWiseQuery = 'DELETE FROM wise_transactions RETURNING id';
    const deletedWise = await client.query(deleteWiseQuery);
    console.log(`   ✅ Deleted ${deletedWise.rowCount} wise_transactions\n`);

    // Step 5: Recalculate currency balances
    console.log('💰 Step 5: Recalculating currency balances...');

    const recalcQuery = `
      WITH balance_calculations AS (
        SELECT
          currency,
          COALESCE(SUM(CASE WHEN type = 'income' THEN total ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN total ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_usd ELSE 0 END), 0) as income_usd,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_usd ELSE 0 END), 0) as expenses_usd
        FROM entries
        WHERE status = 'completed'
        GROUP BY currency
      )
      UPDATE currency_balances cb
      SET
        balance = COALESCE(bc.total_income, 0) - COALESCE(bc.total_expenses, 0),
        balance_usd = COALESCE(bc.income_usd, 0) - COALESCE(bc.expenses_usd, 0),
        last_updated = CURRENT_TIMESTAMP
      FROM balance_calculations bc
      WHERE cb.currency = bc.currency
    `;

    await client.query(recalcQuery);
    console.log('   ✅ Currency balances recalculated\n');

    // Commit transaction
    await client.query('COMMIT');

    // Summary
    console.log('📊 Cleanup Summary');
    console.log('==================\n');
    console.log(`   Entries deleted: ${deletedEntries.rowCount}`);
    console.log(`   Wise transactions deleted: ${deletedWise.rowCount}`);
    console.log('   Currency balances: recalculated\n');
    console.log('✅ Cleanup complete! Ready for fresh Wise sync.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
cleanupWiseTestData();
