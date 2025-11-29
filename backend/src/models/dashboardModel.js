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

    // Get ALL expenses breakdown by category
    const expensesResult = await pool.query(`
      SELECT
        category,
        SUM(total) as total
      FROM entries
      WHERE type = 'expense'
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

  // Get stats for a specific month
  async getMonthlyStats(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

    // Get income and expenses for the month (excluding Transfers from expenses)
    // Use COALESCE(amount_usd, total) to handle multi-currency correctly
    const totalsResult = await pool.query(`
      SELECT
        SUM(CASE WHEN type = 'income' THEN COALESCE(amount_usd, total) ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' AND category != 'Transfers' THEN COALESCE(amount_usd, total) ELSE 0 END) as expenses
      FROM entries
      WHERE entry_date >= $1 AND entry_date <= $2
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
    `, [startDate, endDate]);

    // Get expenses by category for the month (excluding Transfers)
    // Use COALESCE(amount_usd, total) for proper currency conversion
    const categoryResult = await pool.query(`
      SELECT
        category,
        SUM(COALESCE(amount_usd, total)) as total
      FROM entries
      WHERE type = 'expense'
        AND category != 'Transfers'
        AND entry_date >= $1 AND entry_date <= $2
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      GROUP BY category
      ORDER BY SUM(COALESCE(amount_usd, total)) DESC
    `, [startDate, endDate]);

    const totals = totalsResult.rows[0];
    const income = parseFloat(totals.income || 0);
    const expenses = parseFloat(totals.expenses || 0);

    return {
      year,
      month,
      income,
      expenses,
      profit: income - expenses,
      expenses_by_category: categoryResult.rows.map(row => ({
        category: row.category,
        total: parseFloat(row.total)
      }))
    };
  },

  // Get category breakdown for pie chart (excluding Transfers)
  // Use amount_usd for proper multi-currency comparison
  async getCategoryBreakdown(startDate = null, endDate = null) {
    let query = `
      SELECT
        category,
        SUM(COALESCE(amount_usd, total)) as total
      FROM entries
      WHERE type = 'expense'
        AND category != 'Transfers'
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
      ORDER BY SUM(COALESCE(amount_usd, total)) DESC
    `;

    const result = await pool.query(query, params);

    // Calculate total for percentages
    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.total), 0);

    return result.rows.map(row => ({
      name: row.category,
      value: parseFloat(row.total),
      percentage: total > 0 ? ((parseFloat(row.total) / total) * 100).toFixed(1) : 0
    }));
  },

  // Get all expenses for a specific category in a month
  // Use amount_usd for proper multi-currency comparison and sorting
  async getExpensesByCategory(year, month, category) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT id, description, total, entry_date, status, currency,
             COALESCE(amount_usd, total) as amount_usd
      FROM entries
      WHERE type = 'expense'
        AND category = $3
        AND entry_date >= $1 AND entry_date <= $2
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      ORDER BY COALESCE(amount_usd, total) DESC
    `, [startDate, endDate, category]);

    return result.rows.map(row => ({
      id: row.id,
      description: row.description,
      amount: parseFloat(row.amount_usd),
      originalAmount: parseFloat(row.total),
      currency: row.currency || 'USD',
      date: row.entry_date,
      status: row.status
    }));
  },

  // Get top N expenses for a month (excluding Transfers)
  // Sort by USD equivalent for proper multi-currency comparison
  async getTopExpenses(year, month, limit = 10) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT id, description, category, total, entry_date, currency,
             COALESCE(amount_usd, total) as amount_usd
      FROM entries
      WHERE type = 'expense'
        AND category != 'Transfers'
        AND entry_date >= $1 AND entry_date <= $2
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      ORDER BY COALESCE(amount_usd, total) DESC
      LIMIT $3
    `, [startDate, endDate, limit]);

    return result.rows.map(row => ({
      id: row.id,
      description: row.description,
      category: row.category,
      amount: parseFloat(row.amount_usd),
      originalAmount: parseFloat(row.total),
      currency: row.currency || 'USD',
      date: row.entry_date
    }));
  },

  // Get expenses grouped by vendor/description (excluding Transfers)
  // Use amount_usd for proper multi-currency comparison
  async getVendorBreakdown(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT
        description as vendor,
        COUNT(*) as transaction_count,
        SUM(COALESCE(amount_usd, total)) as total
      FROM entries
      WHERE type = 'expense'
        AND category != 'Transfers'
        AND entry_date >= $1 AND entry_date <= $2
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      GROUP BY description
      ORDER BY SUM(COALESCE(amount_usd, total)) DESC
    `, [startDate, endDate]);

    return result.rows.map(row => ({
      vendor: row.vendor,
      transactionCount: parseInt(row.transaction_count),
      total: parseFloat(row.total)
    }));
  },

  // Get category comparison between this month and last month
  // Use amount_usd for proper multi-currency comparison
  async getCategoryComparison(year, month) {
    const thisMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const thisMonthEnd = new Date(year, month, 0).toISOString().split('T')[0];

    const lastMonth = month === 1 ? 12 : month - 1;
    const lastMonthYear = month === 1 ? year - 1 : year;
    const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`;
    const lastMonthEnd = new Date(lastMonthYear, lastMonth, 0).toISOString().split('T')[0];

    // Get this month's expenses by category
    const thisMonthResult = await pool.query(`
      SELECT category, SUM(COALESCE(amount_usd, total)) as total
      FROM entries
      WHERE type = 'expense'
        AND category != 'Transfers'
        AND entry_date >= $1 AND entry_date <= $2
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      GROUP BY category
    `, [thisMonthStart, thisMonthEnd]);

    // Get last month's expenses by category
    const lastMonthResult = await pool.query(`
      SELECT category, SUM(COALESCE(amount_usd, total)) as total
      FROM entries
      WHERE type = 'expense'
        AND category != 'Transfers'
        AND entry_date >= $1 AND entry_date <= $2
        AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE))
      GROUP BY category
    `, [lastMonthStart, lastMonthEnd]);

    // Create lookup for last month
    const lastMonthMap = {};
    lastMonthResult.rows.forEach(row => {
      lastMonthMap[row.category] = parseFloat(row.total);
    });

    // Compare and calculate changes
    return thisMonthResult.rows.map(row => {
      const thisMonthTotal = parseFloat(row.total);
      const lastMonthTotal = lastMonthMap[row.category] || 0;
      const change = lastMonthTotal > 0
        ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)
        : null;

      return {
        category: row.category,
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        change: change ? parseFloat(change) : null,
        isNew: lastMonthTotal === 0
      };
    }).sort((a, b) => b.thisMonth - a.thisMonth);
  }
};

module.exports = DashboardModel;
