const pool = require('../src/config/database');

/**
 * Delete incorrect weekly salary entries that fall on Sundays
 * These were created before we fixed the calculation logic
 */
async function cleanupWeeklyEntries() {
  console.log('Starting cleanup of incorrect weekly salary entries...');

  try {
    // First, show what we're about to delete
    const checkQuery = `
      SELECT e.id, e.description, e.entry_date, e.total, emp.name
      FROM entries e
      JOIN employees emp ON e.employee_id = emp.id
      WHERE emp.pay_type = 'weekly'
      AND e.category = 'Employee'
      AND EXTRACT(DOW FROM e.entry_date) = 0
      ORDER BY emp.name, e.entry_date;
    `;

    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length === 0) {
      console.log('No Sunday entries found for weekly employees. Nothing to clean up.');
      process.exit(0);
    }

    console.log(`\nFound ${checkResult.rows.length} Sunday entries to delete:`);
    checkResult.rows.forEach(row => {
      console.log(`  - ID ${row.id}: ${row.name} - ${row.description} - ${row.entry_date} - $${row.total}`);
    });

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
    console.log('Next step: Visit the Salaries tab to auto-generate correct entries on Fridays');

    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupWeeklyEntries();
