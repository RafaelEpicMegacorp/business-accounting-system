const pool = require('../config/database');

const DashboardModel = {
  // Get comprehensive dashboard statistics
  async getStats() {
    // Get basic totals (completed + past pending entries)
    const totalsResult = await pool.query(`
      SELECT
        SUM(CASE WHEN type = 'income' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) as total_expenses,
        SUM(CASE WHEN type = 'income' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) -
        SUM(CASE WHEN type = 'expense' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) as current_balance,
        SUM(CASE WHEN type = 'income' AND status = 'pending' AND entry_date >= CURRENT_DATE THEN total ELSE 0 END) as pending_income,
        SUM(CASE WHEN type = 'expense' AND status = 'pending' AND entry_date >= CURRENT_DATE THEN total ELSE 0 END) as pending_expenses
      FROM entries
    `);

    // Get salary breakdown
    const salariesResult = await pool.query(`
      SELECT
        SUM(CASE WHEN status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE) THEN total ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'pending' AND entry_date >= CURRENT_DATE THEN total ELSE 0 END) as pending,
        COUNT(*) as total_count
      FROM entries
      WHERE type = 'expense' AND category = 'Employee'
    `);

    // Get non-salary expenses breakdown
    const expensesResult = await pool.query(`
      SELECT
        category,
        SUM(total) as total
      FROM entries
      WHERE type = 'expense'
        AND category != 'Employee'
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      GROUP BY category
      ORDER BY total DESC
    `);

    // Get active contracts stats
    const contractsResult = await pool.query(`
      SELECT
        COUNT(*) as active_contracts,
        SUM(CASE WHEN contract_type = 'monthly' THEN amount ELSE 0 END) as monthly_recurring_revenue
      FROM contracts
      WHERE status = 'active'
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    `);

    // Get employee count
    const employeeResult = await pool.query(
      'SELECT COUNT(*) as active_employees FROM employees WHERE is_active = true'
    );

    const totals = totalsResult.rows[0];
    const salaries = salariesResult.rows[0];
    const contracts = contractsResult.rows[0];
    const employees = employeeResult.rows[0];

    return {
      // Current state
      current_balance: parseFloat(totals.current_balance || 0),
      total_income: parseFloat(totals.total_income || 0),
      total_expenses: parseFloat(totals.total_expenses || 0),

      // Pending
      pending_income: parseFloat(totals.pending_income || 0),
      pending_expenses: parseFloat(totals.pending_expenses || 0),

      // Salaries
      salaries_paid: parseFloat(salaries.paid || 0),
      salaries_pending: parseFloat(salaries.pending || 0),
      salary_entries_count: parseInt(salaries.total_count || 0),

      // Expenses breakdown
      expenses_by_category: expensesResult.rows.map(row => ({
        category: row.category,
        total: parseFloat(row.total)
      })),

      // Contracts
      active_contracts: parseInt(contracts.active_contracts || 0),
      monthly_recurring_revenue: parseFloat(contracts.monthly_recurring_revenue || 0),

      // Team
      active_employees: parseInt(employees.active_employees || 0)
    };
  }
};

module.exports = DashboardModel;
