import api from './api';

const transactionService = {
  /**
   * Get transactions for review with filtering and pagination
   * @param {Object} filters - Filter parameters
   * @returns {Promise} API response
   */
  async getTransactionsForReview(filters = {}) {
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.needs_review !== undefined) params.append('needs_review', filters.needs_review);
    if (filters.min_confidence !== undefined) params.append('min_confidence', filters.min_confidence);
    if (filters.max_confidence !== undefined) params.append('max_confidence', filters.max_confidence);
    if (filters.currency) params.append('currency', filters.currency);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const queryString = params.toString();
    const url = `/wise/transactions/review${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  },

  /**
   * Get transaction review statistics
   * @returns {Promise} API response
   */
  async getReviewStats() {
    const response = await api.get('/wise/transactions/review/stats');
    return response.data;
  },

  /**
   * Update transaction classification
   * @param {number} id - Transaction ID
   * @param {Object} updates - Classification updates
   * @returns {Promise} API response
   */
  async updateTransactionClassification(id, updates) {
    const response = await api.patch(`/wise/transactions/${id}`, updates);
    return response.data;
  },

  /**
   * Approve transaction and create entry
   * @param {number} id - Transaction ID
   * @param {Object} data - Approval data (category, employee_id, status)
   * @returns {Promise} API response
   */
  async approveTransaction(id, data = {}) {
    const response = await api.post(`/wise/transactions/${id}/approve`, data);
    return response.data;
  },

  /**
   * Reject transaction
   * @param {number} id - Transaction ID
   * @param {string} reason - Rejection reason
   * @returns {Promise} API response
   */
  async rejectTransaction(id, reason) {
    const response = await api.post(`/wise/transactions/${id}/reject`, { reason });
    return response.data;
  },

  /**
   * Bulk approve transactions
   * @param {Array<number>} transaction_ids - Transaction IDs
   * @param {Object} data - Default data for all (default_category, status)
   * @returns {Promise} API response
   */
  async bulkApproveTransactions(transaction_ids, data = {}) {
    const response = await api.post('/wise/transactions/bulk-approve', {
      transaction_ids,
      default_category: data.default_category,
      status: data.status || 'completed'
    });
    return response.data;
  },

  /**
   * Bulk reject transactions
   * @param {Array<number>} transaction_ids - Transaction IDs
   * @param {string} reason - Rejection reason
   * @returns {Promise} API response
   */
  async bulkRejectTransactions(transaction_ids, reason) {
    const response = await api.post('/wise/transactions/bulk-reject', {
      transaction_ids,
      reason
    });
    return response.data;
  },

  /**
   * Update all transactions with matching merchant name
   * @param {string} merchantName - Merchant name to match
   * @param {string} category - Category to assign
   * @returns {Promise} API response
   */
  async updateByMerchant(merchantName, category) {
    const response = await api.post('/wise/transactions/bulk-update-by-merchant', {
      merchant_name: merchantName,
      classified_category: category
    });
    return response.data;
  }
};

export default transactionService;
