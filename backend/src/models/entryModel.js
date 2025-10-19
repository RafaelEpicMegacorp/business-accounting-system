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

    // Get Wise balance (actual bank balance) - use this for forecast
    let wiseBalance = 0;
    try {
      const wiseBalanceResult = await pool.query(`
        SELECT
          SUM(
            CASE cb.currency
              WHEN 'USD' THEN cb.balance
              WHEN 'EUR' THEN cb.balance * COALESCE(er.rate, 1.0)
              WHEN 'GBP' THEN cb.balance * COALESCE(er2.rate, 1.0)
              WHEN 'PLN' THEN cb.balance * COALESCE(er3.rate, 1.0)
              ELSE cb.balance
            END
          ) as total_usd
        FROM currency_balances cb
        LEFT JOIN exchange_rates er ON er.from_currency = 'EUR' AND er.to_currency = 'USD' AND er.is_active = true
        LEFT JOIN exchange_rates er2 ON er2.from_currency = 'GBP' AND er2.to_currency = 'USD' AND er2.is_active = true
        LEFT JOIN exchange_rates er3 ON er3.from_currency = 'PLN' AND er3.to_currency = 'USD' AND er3.is_active = true
      `);
      wiseBalance = parseFloat(wiseBalanceResult.rows[0]?.total_usd || 0);
    } catch (error) {
      console.error('Error fetching Wise balance for forecast:', error);
      // Fallback to zero if Wise balance unavailable
      wiseBalance = 0;
    }

    // Also get accounting balance (from entries) for reconciliation
    const totalsResult = await this.getTotals();
    const accountingBalance = parseFloat(totalsResult.net_balance || 0);

    // Use Wise balance for forecast calculation (actual bank balance)
    const currentBalance = wiseBalance;
    const totalForecastedExpenses = weeklyPayments + monthlyPayments;
    const forecastedBalance = currentBalance + contractIncome - totalForecastedExpenses;

    return {
      current_balance: currentBalance.toFixed(2),
      accounting_balance: accountingBalance.toFixed(2), // For reconciliation reference
      balance_difference: (currentBalance - accountingBalance).toFixed(2),
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
  },

  // Generate missing salary entries for all active employees in a given month
  async generateMissingSalaryEntries(year, month) {
    // First, clean up any incorrect Sunday entries for weekly employees in this month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    await pool.query(
      `DELETE FROM entries
       WHERE id IN (
         SELECT e.id FROM entries e
         JOIN employees emp ON e.employee_id = emp.id
         WHERE emp.pay_type = 'weekly'
         AND e.category = 'Employee'
         AND EXTRACT(DOW FROM e.entry_date) = 0
         AND e.entry_date >= $1
         AND e.entry_date <= $2
       )`,
      [firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0]]
    );

    // Get all active employees
    const employeesResult = await pool.query(
      'SELECT * FROM employees WHERE is_active = true'
    );
    const employees = employeesResult.rows;

    const generatedEntries = [];

    for (const employee of employees) {
      const payRate = parseFloat(employee.pay_rate);
      const multiplier = parseFloat(employee.pay_multiplier);

      if (employee.pay_type === 'weekly') {
        // For weekly employees, pay_rate is monthly salary - divide by 4 for weekly
        const weeklyBaseAmount = payRate / 4;
        const weeklyTotal = weeklyBaseAmount * multiplier;

        // Generate weekly entries (one for each Friday in the month)
        const fridays = [];
        let currentDate = new Date(firstDay);

        // Find first Friday (day 5)
        while (currentDate.getDay() !== 5) {
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Collect all Fridays in the month
        while (currentDate <= lastDay) {
          fridays.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 7);
        }

        // Check if entries already exist for these dates
        for (const friday of fridays) {
          const dateString = friday.toISOString().split('T')[0];

          // Check if entry already exists
          const existingEntry = await pool.query(
            `SELECT id FROM entries
             WHERE employee_id = $1
             AND entry_date = $2
             AND type = 'expense'
             AND category = 'Employee'`,
            [employee.id, dateString]
          );

          if (existingEntry.rows.length === 0) {
            // Create new entry
            const result = await pool.query(
              `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING *`,
              [
                'expense',
                'Employee',
                `Weekly salary - ${employee.name}`,
                `Week ending ${dateString}`,
                weeklyBaseAmount,
                weeklyTotal,
                dateString,
                'pending',
                employee.id
              ]
            );
            generatedEntries.push(result.rows[0]);
          }
        }
      } else if (employee.pay_type === 'monthly') {
        // For monthly employees, pay_rate is the monthly salary
        const monthlyTotal = payRate * multiplier;

        // Generate monthly entry (last day of month)
        const dateString = lastDay.toISOString().split('T')[0];

        // Check if entry already exists
        const existingEntry = await pool.query(
          `SELECT id FROM entries
           WHERE employee_id = $1
           AND entry_date = $2
           AND type = 'expense'
           AND category = 'Employee'`,
          [employee.id, dateString]
        );

        if (existingEntry.rows.length === 0) {
          // Create new entry
          const result = await pool.query(
            `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, employee_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
              'expense',
              'Employee',
              `Monthly salary - ${employee.name}`,
              `Month ending ${dateString}`,
              payRate,
              monthlyTotal,
              dateString,
              'pending',
              employee.id
            ]
          );
          generatedEntries.push(result.rows[0]);
        }
      }
    }

    return {
      generated: generatedEntries.length,
      entries: generatedEntries
    };
  }
};

module.exports = EntryModel;
