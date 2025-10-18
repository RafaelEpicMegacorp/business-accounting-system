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

  // Get total balance in USD (convert all currencies to USD)
  static async getTotalBalanceInUSD() {
    const balances = await this.getCurrencyBalances();
    const axios = require('axios');

    try {
      // Fetch current exchange rates from exchangerate-api.com (free tier)
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      const rates = response.data.rates;

      let totalUSD = 0;
      const breakdown = [];

      for (const balance of balances) {
        const amount = parseFloat(balance.balance);
        let amountInUSD = amount;

        if (balance.currency === 'USD') {
          amountInUSD = amount;
        } else if (balance.currency === 'PLN') {
          // Convert PLN to USD
          amountInUSD = amount / rates.PLN;
        } else if (balance.currency === 'EUR') {
          // Convert EUR to USD
          amountInUSD = amount / rates.EUR;
        } else if (balance.currency === 'GBP') {
          // Convert GBP to USD
          amountInUSD = amount / rates.GBP;
        }

        totalUSD += amountInUSD;

        breakdown.push({
          currency: balance.currency,
          original_amount: amount,
          usd_equivalent: amountInUSD,
          exchange_rate: balance.currency === 'USD' ? 1.0 : (1 / rates[balance.currency])
        });
      }

      return {
        total_usd: totalUSD,
        breakdown,
        rates_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching exchange rates:', error);

      // Fallback: use last known rates from currency_exchanges table
      const fallbackQuery = `
        SELECT from_currency, to_currency, exchange_rate
        FROM currency_exchanges
        WHERE to_currency = 'USD'
        ORDER BY exchange_date DESC, created_at DESC
        LIMIT 10
      `;

      const fallbackRates = await pool.query(fallbackQuery);
      const rateMap = {};
      fallbackRates.rows.forEach(row => {
        if (!rateMap[row.from_currency]) {
          rateMap[row.from_currency] = parseFloat(row.exchange_rate);
        }
      });

      let totalUSD = 0;
      const breakdown = [];

      for (const balance of balances) {
        const amount = parseFloat(balance.balance);
        let amountInUSD = amount;

        if (balance.currency === 'USD') {
          amountInUSD = amount;
        } else if (rateMap[balance.currency]) {
          amountInUSD = amount * rateMap[balance.currency];
        } else {
          // Default fallback rates if no database data
          const defaultRates = { PLN: 0.25, EUR: 1.1, GBP: 1.27 };
          amountInUSD = amount * (defaultRates[balance.currency] || 1.0);
        }

        totalUSD += amountInUSD;

        breakdown.push({
          currency: balance.currency,
          original_amount: amount,
          usd_equivalent: amountInUSD,
          exchange_rate: balance.currency === 'USD' ? 1.0 : (rateMap[balance.currency] || 0.25)
        });
      }

      return {
        total_usd: totalUSD,
        breakdown,
        rates_updated: new Date().toISOString(),
        fallback_used: true
      };
    }
  }
}

module.exports = CurrencyModel;
