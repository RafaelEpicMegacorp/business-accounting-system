const pool = require('../config/database');

class CurrencyModel {
  // Get all currency balances
  static async getCurrencyBalances() {
    const query = `
      SELECT currency, balance, last_updated, created_at
      FROM currency_balances
      ORDER BY currency
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Get currency exchanges
  static async getCurrencyExchanges(limit = 100) {
    const query = `
      SELECT id, from_currency, to_currency, from_amount, to_amount,
             exchange_rate, fee_amount, exchange_date, wise_id, description, created_at
      FROM currency_exchanges
      ORDER BY exchange_date DESC, created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Manually trigger balance recalculation
  static async recalculateBalances() {
    const query = `SELECT recalculate_currency_balances()`;
    await pool.query(query);

    // Return updated balances
    return await this.getCurrencyBalances();
  }

  // Get balance for a specific currency
  static async getBalanceByCurrency(currency) {
    const query = `
      SELECT currency, balance, last_updated, created_at
      FROM currency_balances
      WHERE currency = $1
    `;

    const result = await pool.query(query, [currency]);
    return result.rows[0] || null;
  }

  // Get Wise entries by currency
  static async getWiseEntriesByCurrency(currency, limit = 50) {
    const query = `
      SELECT id, type, category, description, detail,
             base_amount, total, currency, amount_original, amount_usd,
             exchange_rate, entry_date, status, created_at
      FROM entries
      WHERE currency = $1
        AND (detail LIKE '%Wise ID:%' OR detail LIKE '%Opening Balance%')
      ORDER BY entry_date DESC, created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [currency, limit]);
    return result.rows;
  }

  // Get currency summary (income, expenses, balance)
  static async getCurrencySummary() {
    const query = `
      SELECT
        currency,
        SUM(CASE WHEN type = 'income' THEN amount_original ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount_original ELSE 0 END) as total_expenses,
        COUNT(*) as transaction_count
      FROM entries
      WHERE (detail LIKE '%Wise ID:%' OR detail LIKE '%Opening Balance%')
        AND status = 'completed'
      GROUP BY currency
      ORDER BY currency
    `;

    const result = await pool.query(query);

    // Get balances
    const balances = await this.getCurrencyBalances();

    // Merge summary with balances
    return result.rows.map(row => {
      const balance = balances.find(b => b.currency === row.currency);
      return {
        ...row,
        balance: balance ? parseFloat(balance.balance) : 0,
        net: parseFloat(row.total_income) - parseFloat(row.total_expenses)
      };
    });
  }
}

module.exports = CurrencyModel;
