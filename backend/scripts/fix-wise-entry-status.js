/**
 * Migration Script: Fix Wise Entry Status Based on Confidence
 *
 * This script updates the status of Wise-imported entries based on their confidence scores.
 * Entries with confidence < 40% should be marked as 'pending' for manual review.
 * Entries with confidence >= 40% should be marked as 'completed'.
 *
 * Run with: node scripts/fix-wise-entry-status.js
 */

const pool = require('../src/config/database');

async function fixWiseEntryStatus() {
  const client = await pool.getClient();

  try {
    console.log('🔧 Starting Wise entry status fix...\n');

    // Find all entries that were imported from Wise (have "Auto-imported from Wise" in detail)
    const wiseEntriesResult = await client.query(`
      SELECT id, description, detail, status
      FROM entries
      WHERE detail LIKE '%Auto-imported from Wise%'
      OR detail LIKE '%Confidence:%'
      ORDER BY id
    `);

    const wiseEntries = wiseEntriesResult.rows;
    console.log(`📋 Found ${wiseEntries.length} Wise-imported entries\n`);

    if (wiseEntries.length === 0) {
      console.log('✓ No Wise entries found. Nothing to fix.');
      return;
    }

    let updatedCount = 0;
    let alreadyCorrect = 0;

    for (const entry of wiseEntries) {
      // Extract confidence from detail field
      const confidenceMatch = entry.detail.match(/Confidence:\s*(\d+)%/);

      if (!confidenceMatch) {
        console.log(`⚠️  Entry ${entry.id}: No confidence score found, skipping`);
        continue;
      }

      const confidence = parseInt(confidenceMatch[1], 10);
      const expectedStatus = confidence >= 40 ? 'completed' : 'pending';
      const currentStatus = entry.status;

      if (currentStatus === expectedStatus) {
        alreadyCorrect++;
        console.log(`✓ Entry ${entry.id}: Already correct (${confidence}% → ${currentStatus})`);
        continue;
      }

      // Update status
      await client.query(
        `UPDATE entries SET status = $1 WHERE id = $2`,
        [expectedStatus, entry.id]
      );

      updatedCount++;
      console.log(`🔄 Entry ${entry.id}: Updated ${currentStatus} → ${expectedStatus} (Confidence: ${confidence}%)`);
      console.log(`   Description: ${entry.description.substring(0, 60)}...`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY:');
    console.log(`   Total Wise entries: ${wiseEntries.length}`);
    console.log(`   Already correct: ${alreadyCorrect}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log('='.repeat(70) + '\n');

    if (updatedCount > 0) {
      console.log('✅ Fix completed successfully!');
    } else {
      console.log('✓ All entries were already correct.');
    }

  } catch (error) {
    console.error('❌ Error fixing Wise entry status:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the fix
fixWiseEntryStatus()
  .then(() => {
    console.log('\n🎉 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
