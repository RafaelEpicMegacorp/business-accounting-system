const pool = require('../config/database');

/**
 * ForecastModel - Multi-month projections with Poland LLC tax calculations
 *
 * Tax rates for Sp. z o.o. (Polish LLC):
 * - CIT: 9% for small taxpayers (revenue < 2M EUR), 19% standard
 * - ZUS employer contributions: ~20.48% of gross salaries
 * - VAT: 23% standard rate
 */

const ForecastModel = {
  // ===============================
  // TAX SETTINGS
  // ===============================

  /**
   * Get all tax settings
   * Returns defaults if tax_settings table doesn't exist (migration 019 not run)
   */
  async getTaxSettings() {
    try {
      const result = await pool.query(
        'SELECT setting_key, setting_value, description FROM tax_settings'
      );

      // Convert to object for easy access
      const settings = {};
      result.rows.forEach(row => {
        settings[row.setting_key] = {
          value: row.setting_value,
          description: row.description
        };
      });
      return settings;
    } catch (error) {
      // Table doesn't exist - return Poland LLC defaults
      console.log('tax_settings table not found, using defaults');
      return {
        cit_rate: { value: '9', description: 'CIT rate (small taxpayer)' },
        zus_employer_rate: { value: '20.48', description: 'Employer ZUS rate' }
      };
    }
  },

  /**
   * Update a tax setting
   */
  async updateTaxSetting(key, value) {
    const result = await pool.query(
      `UPDATE tax_settings
       SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = $2
       RETURNING *`,
      [value, key]
    );
    return result.rows[0];
  },

  /**
   * Update multiple tax settings at once
   */
  async updateTaxSettings(settings) {
    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      const result = await pool.query(
        `UPDATE tax_settings
         SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = $2
         RETURNING *`,
        [value, key]
      );
      if (result.rows[0]) {
        updates.push(result.rows[0]);
      }
    }
    return updates;
  },

  // ===============================
  // TAX CALCULATIONS
  // ===============================

  /**
   * Calculate Poland LLC taxes
   * @param {Object} params - { income, expenses, salaryExpenses }
   * @param {Object} taxSettings - Tax settings from getTaxSettings()
   * @returns {Object} Tax breakdown
   */
  calculateTaxes(params, taxSettings) {
    const { income = 0, expenses = 0, salaryExpenses = 0 } = params;

    // Get rates from settings (with defaults)
    const citRate = parseFloat(taxSettings?.cit_rate?.value || 9) / 100;
    const zusRate = parseFloat(taxSettings?.zus_employer_rate?.value || 20.48) / 100;

    // Calculate taxable profit (income - all expenses including salaries)
    const taxableProfit = Math.max(0, income - expenses);

    // CIT (Corporate Income Tax) on profit
    const citAmount = taxableProfit * citRate;

    // ZUS employer contributions (on salary expenses only)
    const zusAmount = salaryExpenses * zusRate;

    // Total tax burden
    const totalTaxBurden = citAmount + zusAmount;

    // Effective tax rate (as percentage of income)
    const effectiveTaxRate = income > 0 ? (totalTaxBurden / income) * 100 : 0;

    return {
      taxableProfit: parseFloat(taxableProfit.toFixed(2)),
      cit: parseFloat(citAmount.toFixed(2)),
      citRate: citRate * 100,
      zus: parseFloat(zusAmount.toFixed(2)),
      zusRate: zusRate * 100,
      totalTaxBurden: parseFloat(totalTaxBurden.toFixed(2)),
      effectiveTaxRate: parseFloat(effectiveTaxRate.toFixed(2))
    };
  },

  // ===============================
  // RECURRING EXPENSE DETECTION
  // ===============================

  /**
   * Detect recurring expense patterns from historical data
   * Looks for expenses that occur regularly with consistent amounts
   */
  async detectRecurringExpenses() {
    const result = await pool.query(`
      WITH expense_occurrences AS (
        SELECT
          LOWER(TRIM(description)) as normalized_description,
          category,
          COUNT(*) as occurrence_count,
          AVG(total) as avg_amount,
          STDDEV(total) as amount_variance,
          MAX(entry_date) as last_occurrence,
          MIN(entry_date) as first_occurrence,
          currency
        FROM entries
        WHERE type = 'expense'
          AND category NOT IN ('Employee', 'salary')
          AND entry_date >= CURRENT_DATE - INTERVAL '12 months'
          AND total > 0
        GROUP BY LOWER(TRIM(description)), category, currency
        HAVING COUNT(*) >= 2
      )
      SELECT
        normalized_description as description,
        category,
        ROUND(avg_amount::numeric, 2) as typical_amount,
        currency,
        occurrence_count,
        last_occurrence,
        first_occurrence,
        CASE
          WHEN occurrence_count >= 10 AND
               EXTRACT(DAY FROM AGE(last_occurrence, first_occurrence)) / NULLIF(occurrence_count - 1, 0) BETWEEN 25 AND 35
          THEN 'monthly'
          WHEN occurrence_count >= 40 AND
               EXTRACT(DAY FROM AGE(last_occurrence, first_occurrence)) / NULLIF(occurrence_count - 1, 0) BETWEEN 5 AND 9
          THEN 'weekly'
          WHEN occurrence_count >= 3 AND
               EXTRACT(DAY FROM AGE(last_occurrence, first_occurrence)) / NULLIF(occurrence_count - 1, 0) BETWEEN 80 AND 100
          THEN 'quarterly'
          WHEN occurrence_count >= 1 AND
               EXTRACT(DAY FROM AGE(last_occurrence, first_occurrence)) / NULLIF(occurrence_count - 1, 0) BETWEEN 350 AND 380
          THEN 'yearly'
          ELSE 'irregular'
        END as detected_frequency,
        CASE
          WHEN amount_variance IS NULL OR avg_amount = 0 THEN 0.90
          WHEN amount_variance / NULLIF(avg_amount, 0) < 0.05 THEN 0.98
          WHEN amount_variance / NULLIF(avg_amount, 0) < 0.10 THEN 0.95
          WHEN amount_variance / NULLIF(avg_amount, 0) < 0.20 THEN 0.85
          WHEN amount_variance / NULLIF(avg_amount, 0) < 0.50 THEN 0.70
          ELSE 0.50
        END as confidence_score
      FROM expense_occurrences
      ORDER BY avg_amount DESC
    `);

    // Filter to only include patterns with reasonable confidence
    const patterns = result.rows.filter(p =>
      p.detected_frequency !== 'irregular' &&
      parseFloat(p.confidence_score) >= 0.70
    );

    // Calculate total monthly recurring amount
    let totalMonthlyRecurring = 0;
    patterns.forEach(p => {
      const amount = parseFloat(p.typical_amount);
      switch (p.detected_frequency) {
        case 'weekly':
          totalMonthlyRecurring += amount * 4.33; // Average weeks per month
          break;
        case 'monthly':
          totalMonthlyRecurring += amount;
          break;
        case 'quarterly':
          totalMonthlyRecurring += amount / 3;
          break;
        case 'yearly':
          totalMonthlyRecurring += amount / 12;
          break;
      }
    });

    return {
      patterns,
      totalMonthlyRecurring: parseFloat(totalMonthlyRecurring.toFixed(2))
    };
  },

  /**
   * Get saved recurring expense patterns
   * Returns empty array if table doesn't exist (migration 019 not run)
   */
  async getSavedPatterns() {
    try {
      const result = await pool.query(`
        SELECT * FROM recurring_expense_patterns
        WHERE is_active = true
        ORDER BY typical_amount DESC
      `);
      return result.rows;
    } catch (error) {
      // Table doesn't exist
      console.log('recurring_expense_patterns table not found, returning empty');
      return [];
    }
  },

  /**
   * Save or update a recurring expense pattern
   */
  async savePattern(pattern) {
    const { description, category, typical_amount, currency, frequency, confidence_score } = pattern;

    try {
      const result = await pool.query(`
        INSERT INTO recurring_expense_patterns
          (description, category, typical_amount, currency, frequency, confidence_score, is_user_confirmed)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (description, category) DO UPDATE SET
          typical_amount = EXCLUDED.typical_amount,
          frequency = EXCLUDED.frequency,
          is_user_confirmed = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [description, category, typical_amount, currency || 'USD', frequency, confidence_score || 1.0]);

      return result.rows[0];
    } catch (error) {
      // Table doesn't exist - return mock saved pattern
      console.log('recurring_expense_patterns table not found, returning mock');
      return {
        id: Date.now(),
        description,
        category,
        typical_amount,
        currency: currency || 'USD',
        frequency,
        confidence_score: confidence_score || 1.0,
        is_user_confirmed: true,
        is_active: true
      };
    }
  },

  /**
   * Update a recurring expense pattern
   */
  async updatePattern(id, data) {
    const { typical_amount, frequency, category, description } = data;

    try {
      const result = await pool.query(`
        UPDATE recurring_expense_patterns
        SET typical_amount = COALESCE($1, typical_amount),
            frequency = COALESCE($2, frequency),
            category = COALESCE($3, category),
            description = COALESCE($4, description),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [typical_amount, frequency, category, description, id]);

      return result.rows[0];
    } catch (error) {
      console.log('recurring_expense_patterns table not found');
      return null;
    }
  },

  /**
   * Delete a recurring expense pattern (soft delete)
   */
  async deletePattern(id) {
    try {
      const result = await pool.query(`
        UPDATE recurring_expense_patterns
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      return result.rows[0];
    } catch (error) {
      console.log('recurring_expense_patterns table not found');
      return null;
    }
  },

  // ===============================
  // MULTI-MONTH PROJECTIONS
  // ===============================

  /**
   * Get multi-month projection data
   * @param {number} months - Number of months to project (1-12)
   * @returns {Object} Projection data with monthly breakdowns
   */
  async getProjection(months = 3) {
    const taxSettings = await this.getTaxSettings();

    // Get current balance (from currency_balances, converted to USD)
    const balanceResult = await pool.query(`
      SELECT
        COALESCE(SUM(
          CASE currency
            WHEN 'USD' THEN balance
            WHEN 'EUR' THEN balance * 1.08
            WHEN 'GBP' THEN balance * 1.27
            WHEN 'PLN' THEN balance * 0.25
            ELSE balance
          END
        ), 0) as total_usd
      FROM currency_balances
    `);
    const startingBalance = parseFloat(balanceResult.rows[0]?.total_usd || 0);

    // Get active contracts for income projection
    const contractsResult = await pool.query(`
      SELECT id, client_name, amount, contract_type, payment_day
      FROM contracts
      WHERE status = 'active'
    `);
    const contracts = contractsResult.rows;

    // Get active employees for salary projection
    // Note: worker_type removed until migration 020 is run (column doesn't exist yet)
    // JS code defaults to 'contractor' for ZUS calculation
    const employeesResult = await pool.query(`
      SELECT id, name, pay_type, pay_rate, pay_multiplier
      FROM employees
      WHERE is_active = true
    `);
    const employees = employeesResult.rows;

    // Get recurring expenses
    const recurringExpenses = await this.detectRecurringExpenses();

    // Build monthly projections
    const projections = [];
    let runningBalance = startingBalance;
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const projectionDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthName = projectionDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(projectionDate.getFullYear(), projectionDate.getMonth() + 1, 0).getDate();

      // Calculate expected income from contracts
      let expectedIncome = 0;
      const incomeDetails = [];
      contracts.forEach(contract => {
        let monthlyAmount = parseFloat(contract.amount);

        // Adjust for contract_type
        if (contract.contract_type === 'yearly') {
          // Only include if payment month matches
          if (contract.payment_day && projectionDate.getMonth() === new Date(contract.payment_day).getMonth()) {
            expectedIncome += monthlyAmount;
            incomeDetails.push({ name: contract.client_name, amount: monthlyAmount, type: 'yearly' });
          }
        } else if (contract.contract_type === 'monthly') {
          expectedIncome += monthlyAmount;
          incomeDetails.push({ name: contract.client_name, amount: monthlyAmount, type: 'monthly' });
        }
      });

      // Calculate expected salary expenses
      // Track employee salaries separately for ZUS (contractors excluded from ZUS)
      let salaryExpenses = 0;
      let employeeSalariesForZUS = 0; // Only actual employees, not contractors
      const salaryDetails = [];
      employees.forEach(emp => {
        const rate = parseFloat(emp.pay_rate);
        const multiplier = parseFloat(emp.pay_multiplier || 1.0);
        const workerType = emp.worker_type || 'contractor';
        let monthlyAmount = 0;

        if (emp.pay_type === 'monthly') {
          monthlyAmount = rate * multiplier;
        } else if (emp.pay_type === 'weekly') {
          // Approximately 4.33 weeks per month
          monthlyAmount = rate * multiplier * 4.33;
        } else if (emp.pay_type === 'hourly') {
          // Assume 160 hours per month
          monthlyAmount = rate * multiplier * 160;
        }

        salaryExpenses += monthlyAmount;

        // Only employees (not contractors) are subject to employer ZUS contributions
        if (workerType === 'employee') {
          employeeSalariesForZUS += monthlyAmount;
        }

        salaryDetails.push({ name: emp.name, amount: monthlyAmount, type: emp.pay_type, workerType });
      });

      // Add recurring expenses
      const monthlyRecurring = recurringExpenses.totalMonthlyRecurring;

      // Total expenses (salaries + recurring)
      const totalExpenses = salaryExpenses + monthlyRecurring;

      // Calculate taxes (ZUS only applies to employees, not contractors)
      const taxes = this.calculateTaxes({
        income: expectedIncome,
        expenses: totalExpenses,
        salaryExpenses: employeeSalariesForZUS  // Only employee salaries for ZUS, not contractors
      }, taxSettings);

      // Calculate ending balance
      const netChange = expectedIncome - totalExpenses - taxes.totalTaxBurden;
      const endingBalance = runningBalance + netChange;

      projections.push({
        month: monthName,
        monthIndex: i,
        startingBalance: parseFloat(runningBalance.toFixed(2)),
        expectedIncome: parseFloat(expectedIncome.toFixed(2)),
        incomeDetails,
        salaryExpenses: parseFloat(salaryExpenses.toFixed(2)),
        salaryDetails,
        recurringExpenses: parseFloat(monthlyRecurring.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        taxes: {
          cit: taxes.cit,
          zus: taxes.zus,
          total: taxes.totalTaxBurden,
          effectiveRate: taxes.effectiveTaxRate
        },
        netChange: parseFloat(netChange.toFixed(2)),
        endingBalance: parseFloat(endingBalance.toFixed(2)),
        isPositive: endingBalance >= 0
      });

      runningBalance = endingBalance;
    }

    // Calculate summary totals
    const summary = {
      totalIncome: projections.reduce((sum, p) => sum + p.expectedIncome, 0),
      totalExpenses: projections.reduce((sum, p) => sum + p.totalExpenses, 0),
      totalSalaries: projections.reduce((sum, p) => sum + p.salaryExpenses, 0),
      totalRecurring: projections.reduce((sum, p) => sum + p.recurringExpenses, 0),
      totalTaxes: projections.reduce((sum, p) => sum + p.taxes.total, 0),
      netPosition: projections.length > 0 ? projections[projections.length - 1].endingBalance - startingBalance : 0,
      finalBalance: projections.length > 0 ? projections[projections.length - 1].endingBalance : startingBalance
    };

    // Format summary values
    Object.keys(summary).forEach(key => {
      summary[key] = parseFloat(summary[key].toFixed(2));
    });

    return {
      projections,
      summary,
      startingBalance: parseFloat(startingBalance.toFixed(2)),
      taxSettings: {
        citRate: parseFloat(taxSettings.cit_rate?.value || 9),
        zusRate: parseFloat(taxSettings.zus_employer_rate?.value || 20.48),
        isSmallTaxpayer: parseFloat(taxSettings.cit_rate?.value || 9) === 9
      },
      recurringExpensePatterns: recurringExpenses.patterns,
      generatedAt: new Date().toISOString()
    };
  }
};

module.exports = ForecastModel;
