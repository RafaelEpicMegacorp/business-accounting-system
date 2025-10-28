const { Pool } = require('pg');

// Connect to production database using DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:iiijaeSBDPUckvGWSopVfrJmvlpNzmDp@gondola.proxy.rlwy.net:41656/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Delete incorrect weekly salary entries that fall on Sundays
 */
async function cleanupWeeklyEntries() {
  console.log('🔍 Connecting to production database...');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected successfully\n');

    // First, show what we're about to delete
    console.log('📋 Querying incorrect Sunday entries for weekly employees...');
    const checkQuery = `
      SELECT e.id, e.description, e.entry_date, e.base_amount, e.total, emp.name, emp.pay_type
      FROM entries e
      JOIN employees emp ON e.employee_id = emp.id
      WHERE emp.pay_type = 'weekly'
      AND e.category = 'Employee'
      AND EXTRACT(DOW FROM e.entry_date) = 0
      ORDER BY emp.name, e.entry_date;
    `;

    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      console.log('✅ No Sunday entries found for weekly employees. Database is clean!');
      await pool.end();
      process.exit(0);
    }

    console.log(`\n⚠️  Found ${checkResult.rows.length} Sunday entries to delete:\n`);
    checkResult.rows.forEach(row => {
      const date = new Date(row.entry_date).toISOString().split('T')[0];
      console.log(`  - ID ${row.id}: ${row.name} | ${row.description} | ${date} (Sunday) | Base: $${row.base_amount} Total: $${row.total}`);
    });

    console.log('\n🗑️  Deleting incorrect entries...');

    // Delete the incorrect entries
    const deleteQuery = `
      DELETE FROM entries
      WHERE id IN (
        SELECT e.id FROM entries e
        JOIN employees emp ON e.employee_id = emp.id
        WHERE emp.pay_type = 'weekly'
        AND e.category = 'Employee'
        AND EXTRACT(DOW FROM e.entry_date) = 0
      )
      RETURNING id;
    `;

    const deleteResult = await pool.query(deleteQuery);

    console.log(`\n✅ Successfully deleted ${deleteResult.rows.length} incorrect entries`);
    console.log('\n📝 Next steps:');
    console.log('   1. Visit https://ds-accounting.netlify.app');
    console.log('   2. Navigate to the Salaries tab');
    console.log('   3. Correct entries will be auto-generated on Fridays');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Run the cleanup
cleanupWeeklyEntries();
