const axios = require('axios');

/**
 * Wise API Service
 * Handles communication with Wise (formerly TransferWise) API
 * Documentation: https://docs.wise.com/api-docs
 */
class WiseService {
  constructor() {
    this.apiToken = process.env.WISE_API_TOKEN;
    this.baseURL = process.env.WISE_API_BASE_URL || 'https://api.transferwise.com';
    this.profileId = process.env.WISE_PROFILE_ID;

    if (!this.apiToken) {
      console.warn('WARNING: WISE_API_TOKEN not configured - Wise integration will not work');
    }

    if (!this.profileId) {
      console.warn('WARNING: WISE_PROFILE_ID not configured - Wise integration will not work');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
  }

  /**
   * Get all balance accounts for the profile
   * @returns {Promise<Array>} List of balance accounts
   */
  async getBalanceAccounts() {
    try {
      // types parameter is required by Wise API v4
      // STANDARD = regular balances, SAVINGS = savings pots
      const response = await this.client.get(`/v4/profiles/${this.profileId}/balances`, {
        params: {
          types: 'STANDARD,SAVINGS'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Wise balance accounts:', error.message);
      console.error('Error response:', error.response?.data);
      throw new Error(`Failed to fetch balance accounts: ${error.message}`);
    }
  }

  /**
   * Get transactions for a specific balance account
   * @param {number} balanceId - The balance account ID
   * @param {Object} options - Query options
   * @param {string} options.intervalStart - Start date (ISO 8601)
   * @param {string} options.intervalEnd - End date (ISO 8601)
   * @param {string} options.type - Transaction type ('CREDIT', 'DEBIT', or 'ALL')
   * @param {number} options.limit - Max results per page (default 100)
   * @returns {Promise<Object>} Transactions data with pagination
   */
  async getBalanceTransactions(balanceId, options = {}) {
    try {
      const params = {
        intervalStart: options.intervalStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
        intervalEnd: options.intervalEnd || new Date().toISOString(),
        type: options.type || 'ALL',
        limit: options.limit || 100,
        offset: options.offset || 0
      };

      const response = await this.client.get(
        `/v1/profiles/${this.profileId}/balance-accounts/${balanceId}/statement.json`,
        { params }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching transactions for balance ${balanceId}:`, error.message);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }

  /**
   * Get all transactions across all balance accounts
   * @param {Object} options - Query options (intervalStart, intervalEnd, type, limit)
   * @returns {Promise<Array>} Combined list of all transactions
   */
  async getAllTransactions(options = {}) {
    try {
      // Get all balance accounts first
      const balances = await this.getBalanceAccounts();

      // Fetch transactions for each balance account
      const transactionPromises = balances.map(balance =>
        this.getBalanceTransactions(balance.id, options)
          .catch(err => {
            console.error(`Failed to fetch transactions for balance ${balance.id}:`, err.message);
            return { transactions: [] }; // Return empty array on error
          })
      );

      const results = await Promise.all(transactionPromises);

      // Combine all transactions
      const allTransactions = results.flatMap(result => result.transactions || []);

      // Sort by date (most recent first)
      allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      return allTransactions;
    } catch (error) {
      console.error('Error fetching all Wise transactions:', error.message);
      throw new Error(`Failed to fetch all transactions: ${error.message}`);
    }
  }

  /**
   * Get transaction details by transaction ID
   * @param {number} balanceId - The balance account ID
   * @param {string} transactionId - The transaction ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionDetails(balanceId, transactionId) {
    try {
      const response = await this.client.get(
        `/v1/profiles/${this.profileId}/balance-accounts/${balanceId}/transactions/${transactionId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching transaction details ${transactionId}:`, error.message);
      throw new Error(`Failed to fetch transaction details: ${error.message}`);
    }
  }

  /**
   * Get recent transactions (last N days)
   * @param {number} days - Number of days to look back (default 7)
   * @returns {Promise<Array>} Recent transactions
   */
  async getRecentTransactions(days = 7) {
    const intervalStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const intervalEnd = new Date().toISOString();

    return this.getAllTransactions({ intervalStart, intervalEnd });
  }

  /**
   * Subscribe to Wise webhooks
   * @param {string} webhookUrl - Your webhook endpoint URL
   * @param {Array<string>} events - Array of event types to subscribe to
   * @returns {Promise<Object>} Subscription details
   */
  async createWebhookSubscription(webhookUrl, events = ['balances#credit', 'balances#update']) {
    try {
      const response = await this.client.post(
        `/v3/profiles/${this.profileId}/subscriptions`,
        {
          name: 'Accounting System Sync',
          trigger_on: events.join(','),
          delivery: {
            version: '2.0.0',
            url: webhookUrl
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating webhook subscription:', error.message);
      throw new Error(`Failed to create webhook subscription: ${error.message}`);
    }
  }

  /**
   * List all webhook subscriptions
   * @returns {Promise<Array>} List of subscriptions
   */
  async getWebhookSubscriptions() {
    try {
      const response = await this.client.get(`/v3/profiles/${this.profileId}/subscriptions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching webhook subscriptions:', error.message);
      throw new Error(`Failed to fetch webhook subscriptions: ${error.message}`);
    }
  }

  /**
   * Delete a webhook subscription
   * @param {string} subscriptionId - The subscription ID to delete
   * @returns {Promise<void>}
   */
  async deleteWebhookSubscription(subscriptionId) {
    try {
      await this.client.delete(`/v3/profiles/${this.profileId}/subscriptions/${subscriptionId}`);
    } catch (error) {
      console.error(`Error deleting webhook subscription ${subscriptionId}:`, error.message);
      throw new Error(`Failed to delete webhook subscription: ${error.message}`);
    }
  }

  /**
   * Test connection to Wise API
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      await this.getBalanceAccounts();
      return true;
    } catch (error) {
      console.error('Wise API connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Parse webhook payload
   * @param {Object} payload - Raw webhook payload from Wise
   * @returns {Object} Normalized transaction data
   */
  parseWebhookPayload(payload) {
    // Wise webhook payload structure
    const data = payload.data;
    const resource = data?.resource;

    return {
      wiseTransactionId: data?.resource_id || resource?.id,
      resourceId: data?.resource_id,
      profileId: data?.profile_id || this.profileId,
      accountId: resource?.account_id,
      type: resource?.type, // 'CREDIT' or 'DEBIT'
      state: resource?.state, // 'COMPLETED', 'PENDING', etc.
      amount: Math.abs(resource?.amount?.value || 0),
      currency: resource?.amount?.currency || 'USD',
      description: resource?.description || resource?.details?.description,
      merchantName: resource?.details?.merchant?.name,
      referenceNumber: resource?.reference_number || resource?.details?.reference,
      transactionDate: resource?.date || resource?.created_at,
      valueDate: resource?.value_date,
      rawPayload: payload
    };
  }
}

module.exports = new WiseService();
