const pool = require('../config/database');

const EntryModel = {
  // Get all entries, sorted by date (most recent first) with employee info
  // Supports optional date range filtering
  async getAll(filters = {}) {
    const { startDate, endDate } = filters;
    let query = `
      SELECT e.*, emp.name as employee_name, emp.pay_type
      FROM entries e
      LEFT JOIN employees emp ON e.employee_id = emp.id
    `;

    const params = [];
    const conditions = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`e.entry_date >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`e.entry_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY e.entry_date DESC, e.id DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get entry by ID with employee info
  async getById(id) {
    const result = await pool.query(
      `SELECT e.*, emp.name as employee_name, emp.pay_type
       FROM entries e
       LEFT JOIN employees emp ON e.employee_id = emp.id
       WHERE e.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Create new entry with date, status, and employee support
  async create(entry) {
    const { type, category, description, detail, baseAmount, total, entryDate, status, employeeId } = entry;
    const result = await pool.query(
      `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [type, category, description, detail || '', baseAmount, total, entryDate || new Date(), status || 'completed', employeeId || null]
    );
    return result.rows[0];
  },

  // Update entry with date, status, and employee support
  async update(id, entry) {
    const { type, category, description, detail, baseAmount, total, entryDate, status, employeeId } = entry;
    const result = await pool.query(
      `UPDATE entries
       SET type = $1, category = $2, description = $3, detail = $4,
           base_amount = $5, total = $6, entry_date = $7, status = $8, employee_id = $9
       WHERE id = $10
       RETURNING *`,
      [type, category, description, detail || '', baseAmount, total, entryDate, status || 'completed', employeeId || null, id]
    );
    return result.rows[0];
  },

  // Delete entry
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM entries WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  // Get totals (completed entries + past pending entries count as completed)
  async getTotals() {
    const result = await pool.query(`
      SELECT
        SUM(CASE WHEN type = 'income' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) as total_expenses,
        SUM(CASE WHEN type = 'income' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) -
        SUM(CASE WHEN type = 'expense' AND (status = 'completed' OR (status = 'pending' AND entry_date < CURRENT_DATE)) THEN total ELSE 0 END) as net_balance,
        SUM(CASE WHEN type = 'income' AND status = 'pending' AND entry_date >= CURRENT_DATE THEN total ELSE 0 END) as pending_income,
        SUM(CASE WHEN type = 'expense' AND status = 'pending' AND entry_date >= CURRENT_DATE THEN total ELSE 0 END) as pending_expenses
      FROM entries
    `);
    return result.rows[0];
  },

  // Get scheduled/pending entries
  async getScheduled() {
    const result = await pool.query(
      'SELECT * FROM entries WHERE status = $1 ORDER BY entry_date ASC',
      ['pending']
    );
    return result.rows;
  },

  // Get income entries only
  async getIncome() {
    const result = await pool.query(
      `SELECT e.*, emp.name as employee_name, emp.pay_type
       FROM entries e
       LEFT JOIN employees emp ON e.employee_id = emp.id
       WHERE e.type = 'income'
       ORDER BY e.entry_date DESC, e.id DESC`
    );
    return result.rows;
  },

  // Get non-employee expense entries (Administration, Software, etc.)
  async getExpenses() {
    const result = await pool.query(
      `SELECT e.*, emp.name as employee_name, emp.pay_type
       FROM entries e
       LEFT JOIN employees emp ON e.employee_id = emp.id
       WHERE e.type = 'expense' AND e.category != 'Employee'
       ORDER BY e.entry_date DESC, e.id DESC`
    );
    return result.rows;
  },

  // Get employee salary entries only
  async getSalaries() {
    const result = await pool.query(
      `SELECT e.*, emp.name as employee_name, emp.pay_type
       FROM entries e
       LEFT JOIN employees emp ON e.employee_id = emp.id
       WHERE e.type = 'expense' AND e.category = 'Employee'
       ORDER BY e.entry_date DESC, e.id DESC`
    );
    return result.rows;
  },

  // Bulk delete entries
  async bulkDelete(ids) {
    const failed = [];
    let affected = 0;

    for (const id of ids) {
      try {
        // Delete the entry
        const result = await pool.query(
          'DELETE FROM entries WHERE id = $1 RETURNING id',
          [id]
        );

        if (result.rows.length > 0) {
          affected++;
        } else {
          failed.push({ id, reason: 'Entry not found' });
        }
      } catch (error) {
        failed.push({ id, reason: error.message });
      }
    }

    return { affected, failed };
  },

  // Bulk update status
  async bulkUpdateStatus(ids, status) {
    const failed = [];
    let affected = 0;

    for (const id of ids) {
      try {
        // Update the entry status
        const result = await pool.query(
          'UPDATE entries SET status = $1 WHERE id = $2 RETURNING id',
          [status, id]
        );

        if (result.rows.length > 0) {
          affected++;
        } else {
          failed.push({ id, reason: 'Entry not found' });
        }
      } catch (error) {
        failed.push({ id, reason: error.message });
      }
    }

    return { affected, failed };
  },

  // Get end-of-month forecast
  async getForecast() {
    // Get current date and end of month
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get all active employees
    const employeesResult = await pool.query(
      'SELECT * FROM employees WHERE is_active = true'
    );
    const employees = employeesResult.rows;

    // Calculate remaining weekly payments
    let weeklyPayments = 0;
    let weeklyDetails = [];
    const daysRemaining = Math.ceil((endOfMonth - today) / (1000 * 60 * 60 * 24));
    const weeksRemaining = Math.ceil(daysRemaining / 7);

    employees.forEach(emp => {
      if (emp.pay_type === 'weekly') {
        const weeklyTotal = parseFloat(emp.pay_rate) * parseFloat(emp.pay_multiplier) * weeksRemaining;
        weeklyPayments += weeklyTotal;
        weeklyDetails.push({
          name: emp.name,
          weeks: weeksRemaining,
          total: weeklyTotal
        });
      }
    });

    // Calculate monthly payments (due at end of month)
    let monthlyPayments = 0;
    let monthlyDetails = [];

    employees.forEach(emp => {
      if (emp.pay_type === 'monthly') {
        const monthlyTotal = parseFloat(emp.pay_rate) * parseFloat(emp.pay_multiplier);
        monthlyPayments += monthlyTotal;
        monthlyDetails.push({
          name: emp.name,
          total: monthlyTotal
        });
      }
    });

    // Get pending contract payments for remainder of month
    const contractsResult = await pool.query(
      `SELECT * FROM contracts
       WHERE status = 'active'
       AND contract_type = 'monthly'
       AND payment_day >= $1
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       ORDER BY payment_day ASC`,
      [today.getDate()]
    );

    let contractIncome = 0;
    let contractDetails = [];
    contractsResult.rows.forEach(contract => {
      const amount = parseFloat(contract.amount);
      contractIncome += amount;
      contractDetails.push({
        client_name: contract.client_name,
        amount: amount,
        payment_day: contract.payment_day,
        payment_date: new Date(today.getFullYear(), today.getMonth(), contract.payment_day).toISOString().split('T')[0]
      });
    });

    // Get current balance
    const totalsResult = await this.getTotals();
    const currentBalance = parseFloat(totalsResult.net_balance || 0);

    const totalForecastedExpenses = weeklyPayments + monthlyPayments;
    const forecastedBalance = currentBalance + contractIncome - totalForecastedExpenses;

    return {
      current_balance: currentBalance.toFixed(2),
      weekly_payments: weeklyPayments.toFixed(2),
      weekly_details: weeklyDetails,
      monthly_payments: monthlyPayments.toFixed(2),
      monthly_details: monthlyDetails,
      contract_income: contractIncome.toFixed(2),
      contract_details: contractDetails,
      total_forecasted_expenses: totalForecastedExpenses.toFixed(2),
      forecasted_balance: forecastedBalance.toFixed(2),
      weeks_remaining: weeksRemaining,
      days_remaining: daysRemaining
    };
  }
};

module.exports = EntryModel;
