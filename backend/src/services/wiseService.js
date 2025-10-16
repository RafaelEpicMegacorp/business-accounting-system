const axios = require('axios');

class WiseService {
  constructor() {
    this.apiToken = process.env.WISE_API_TOKEN;
    this.baseURL = process.env.WISE_API_BASE_URL || 'https://api.transferwise.com';

    if (!this.apiToken) {
      throw new Error('WISE_API_TOKEN environment variable is required');
    }

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          // API returned error response
          console.error('Wise API Error:', error.response.status, error.response.data);
          throw new Error(`Wise API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          // No response received
          console.error('No response from Wise API:', error.message);
          throw new Error(`No response from Wise API: ${error.message}`);
        } else {
          // Request setup error
          console.error('Wise request error:', error.message);
          throw error;
        }
      }
    );
  }

  // ============================================
  // Profile & Account Management
  // ============================================

  /**
   * Get all profiles for the authenticated user
   * @returns {Promise<Array>} Array of profile objects
   */
  async getProfiles() {
    try {
      const response = await this.client.get('/v1/profiles');
      return response.data;
    } catch (error) {
      console.error('Error fetching profiles:', error.message);
      throw error;
    }
  }

  /**
   * Get borderless (multi-currency) accounts
   * @param {number} profileId - Wise profile ID
   * @returns {Promise<Array>} Array of borderless account objects
   */
  async getBorderlessAccounts(profileId) {
    try {
      const response = await this.client.get(`/v1/borderless-accounts`, {
        params: { profileId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching borderless accounts:', error.message);
      throw error;
    }
  }

  /**
   * Get all balance accounts for a profile
   * @param {number} profileId - Wise profile ID
   * @returns {Promise<Array>} Array of balance objects
   */
  async getBalances(profileId) {
    try {
      const response = await this.client.get(`/v4/profiles/${profileId}/balances`, {
        params: { types: 'STANDARD' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching balances:', error.message);
      throw error;
    }
  }

  // ============================================
  // Transaction History
  // ============================================

  /**
   * Get statement for a specific balance
   * @param {number} profileId - Wise profile ID
   * @param {number} balanceId - Balance ID
   * @param {string} currency - Currency code (USD, EUR, GBP, PLN)
   * @param {Date} intervalStart - Start date
   * @param {Date} intervalEnd - End date
   * @returns {Promise<Object>} Statement object with transactions
   */
  async getStatement(profileId, balanceId, currency, intervalStart, intervalEnd) {
    try {
      const params = {
        currency: currency,
        intervalStart: intervalStart.toISOString(),
        intervalEnd: intervalEnd.toISOString(),
        type: 'COMPACT' // COMPACT or FLAT
      };

      const response = await this.client.get(
        `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json`,
        { params }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching statement for ${currency}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all transactions for a balance with pagination
   * Uses the balance movements API which works with read-only tokens
   * @param {number} profileId - Wise profile ID
   * @param {number} balanceId - Balance ID
   * @param {string} currency - Currency code
   * @param {Date} since - Start date (optional)
   * @param {Date} until - End date (optional)
   * @param {number} limit - Max transactions per page (default 100)
   * @returns {Promise<Array>} Array of transaction objects
   */
  async getTransactions(profileId, balanceId, currency, since = null, until = null, limit = 100) {
    try {
      const params = {
        currency: currency,
        size: limit
      };

      if (since) {
        params.createdDateStart = since.toISOString().split('T')[0];
      }
      if (until) {
        params.createdDateEnd = until.toISOString().split('T')[0];
      }

      // Try the newer balance transactions API (v4)
      const response = await this.client.get(
        `/v4/profiles/${profileId}/balances/${balanceId}/transactions`,
        { params }
      );

      return response.data.content || [];
    } catch (error) {
      console.error(`Error fetching transactions for ${currency}:`, error.message);
      // Return empty array if no transactions found
      if (error.message.includes('404') || error.message.includes('403')) {
        console.warn(`⚠️  API token might not have permission for transaction history`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Get complete transaction history for all currencies
   * @param {number} profileId - Wise profile ID
   * @param {Date} startDate - Start date for history
   * @param {Date} endDate - End date for history
   * @returns {Promise<Object>} Object with transactions by currency
   */
  async getAllTransactions(profileId, startDate = null, endDate = null) {
    try {
      // Get all balances first
      const balances = await this.getBalances(profileId);

      if (!startDate) {
        // Default to 2 years ago
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);
      }

      if (!endDate) {
        endDate = new Date();
      }

      const transactionsByCurrency = {};

      // Fetch transactions for each currency
      for (const balance of balances) {
        const currency = balance.currency;
        const balanceId = balance.id;

        console.log(`Fetching ${currency} transactions...`);

        try {
          const statement = await this.getStatement(
            profileId,
            balanceId,
            currency,
            startDate,
            endDate
          );

          transactionsByCurrency[currency] = {
            balance: balance,
            transactions: statement.transactions || [],
            startBalance: statement.accountHolder?.firstTransaction?.amount || 0,
            endBalance: statement.endOfStatementBalance?.value || 0
          };

          console.log(`✓ Found ${statement.transactions?.length || 0} ${currency} transactions`);
        } catch (err) {
          console.warn(`⚠ Could not fetch ${currency} transactions:`, err.message);
          transactionsByCurrency[currency] = {
            balance: balance,
            transactions: [],
            error: err.message
          };
        }
      }

      return transactionsByCurrency;
    } catch (error) {
      console.error('Error fetching all transactions:', error.message);
      throw error;
    }
  }

  // ============================================
  // Account Information
  // ============================================

  /**
   * Get account holder information
   * @param {number} profileId - Wise profile ID
   * @returns {Promise<Object>} Account holder details
   */
  async getAccountDetails(profileId) {
    try {
      const response = await this.client.get(`/v1/profiles/${profileId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching account details:', error.message);
      throw error;
    }
  }

  // ============================================
  // Exchange Rates
  // ============================================

  /**
   * Get current exchange rate
   * @param {string} source - Source currency
   * @param {string} target - Target currency
   * @returns {Promise<number>} Exchange rate
   */
  async getExchangeRate(source, target) {
    try {
      const response = await this.client.get('/v1/rates', {
        params: {
          source,
          target
        }
      });
      return response.data[0]?.rate || 1;
    } catch (error) {
      console.error(`Error fetching exchange rate ${source}->${target}:`, error.message);
      return 1; // Default to 1 if error
    }
  }

  /**
   * Get exchange rates for all currencies to USD
   * @returns {Promise<Object>} Object with currency codes as keys and rates as values
   */
  async getAllExchangeRates() {
    try {
      const currencies = ['EUR', 'GBP', 'PLN'];
      const rates = { 'USD': 1.000000 };

      for (const currency of currencies) {
        rates[currency] = await this.getExchangeRate(currency, 'USD');
      }

      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error.message);
      throw error;
    }
  }
}

module.exports = new WiseService();
