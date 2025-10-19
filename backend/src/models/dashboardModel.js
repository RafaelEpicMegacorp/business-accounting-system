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
  },

  // Get monthly income vs expense data for line chart
  async getChartData(months = 12) {
    const result = await pool.query(`
      SELECT
        TO_CHAR(entry_date, 'Mon') as month,
        EXTRACT(YEAR FROM entry_date) as year,
        EXTRACT(MONTH FROM entry_date) as month_num,
        type,
        SUM(total) as total
      FROM entries
      WHERE entry_date >= CURRENT_DATE - INTERVAL '${months} months'
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      GROUP BY EXTRACT(YEAR FROM entry_date), EXTRACT(MONTH FROM entry_date), TO_CHAR(entry_date, 'Mon'), type
      ORDER BY year, month_num
    `);

    // Format data for frontend chart
    const monthsMap = {};
    result.rows.forEach(row => {
      const key = `${row.month} ${row.year}`;
      if (!monthsMap[key]) {
        monthsMap[key] = { month: row.month, year: row.year, income: 0, expenses: 0 };
      }
      if (row.type === 'income') {
        monthsMap[key].income = parseFloat(row.total);
      } else {
        monthsMap[key].expenses = parseFloat(row.total);
      }
    });

    return Object.values(monthsMap);
  },

  // Get category breakdown for pie chart
  async getCategoryBreakdown(startDate = null, endDate = null) {
    let query = `
      SELECT
        category,
        SUM(total) as total
      FROM entries
      WHERE type = 'expense'
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
    `;

    const params = [];
    if (startDate) {
      params.push(startDate);
      query += ` AND entry_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND entry_date <= $${params.length}`;
    }

    query += `
      GROUP BY category
      ORDER BY total DESC
    `;

    const result = await pool.query(query, params);

    // Calculate total for percentages
    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.total), 0);

    return result.rows.map(row => ({
      name: row.category,
      value: parseFloat(row.total),
      percentage: total > 0 ? ((parseFloat(row.total) / total) * 100).toFixed(1) : 0
    }));
  }
};

module.exports = DashboardModel;
