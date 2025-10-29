import React, { useState, useEffect } from 'react';
import {
  Filter, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, DollarSign, Calendar, User, Tag
} from 'lucide-react';
import transactionService from '../services/transactionService';
import employeeService from '../services/employeeService';

export default function TransactionReview() {
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    status: 'pending',
    needs_review: true,
    min_confidence: undefined,
    max_confidence: undefined,
    currency: undefined,
    start_date: undefined,
    end_date: undefined,
    transaction_type: undefined,
    limit: 50,
    offset: 0
  });

  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  });

  // Category options (matching backend categories)
  const categories = [
    { value: 'software_subscriptions', label: 'Software Subscriptions' },
    { value: 'office_supplies', label: 'Office Supplies' },
    { value: 'travel', label: 'Travel' },
    { value: 'accommodation', label: 'Accommodation' },
    { value: 'meals', label: 'Meals' },
    { value: 'contractor_payments', label: 'Contractor Payments' },
    { value: 'freelancer_payments', label: 'Freelancer Payments' },
    { value: 'salary', label: 'Salary' },
    { value: 'other_expenses', label: 'Other Expenses' },
    { value: 'recurring_income', label: 'Recurring Income' },
    { value: 'project_income', label: 'Project Income' },
    { value: 'other_income', label: 'Other Income' }
  ];

  useEffect(() => {
    loadData();
    loadEmployees();
  }, [filters]);

  useEffect(() => {
    loadStats();
  }, [transactions]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await transactionService.getTransactionsForReview(filters);
      setTransactions(response.data || []);
      setPagination(response.pagination || { total: 0, limit: 50, offset: 0, has_more: false });
      setSelectedTransactions([]);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      showError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await transactionService.getReviewStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await employeeService.getAll(true); // Only active employees
      setEmployees(data || []);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const showError = (message) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset to first page on filter change
    }));
  };

  const handleApprove = async (id) => {
    try {
      await transactionService.approveTransaction(id, { status: 'completed' });
      showSuccess('Transaction approved and entry created');
      loadData();
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      showError(error.response?.data?.message || 'Failed to approve transaction');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      await transactionService.rejectTransaction(id, reason);
      showSuccess('Transaction rejected');
      loadData();
    } catch (error) {
      console.error('Failed to reject transaction:', error);
      showError('Failed to reject transaction');
    }
  };

  const handleCategoryChange = async (id, category) => {
    try {
      await transactionService.updateTransactionClassification(id, {
        classified_category: category
      });
      showSuccess('Category updated');
      loadData();
    } catch (error) {
      console.error('Failed to update category:', error);
      showError('Failed to update category');
    }
  };

  const handleEmployeeChange = async (id, employeeId) => {
    try {
      await transactionService.updateTransactionClassification(id, {
        matched_employee_id: employeeId === '' ? null : parseInt(employeeId)
      });
      showSuccess('Employee assignment updated');
      loadData();
    } catch (error) {
      console.error('Failed to update employee:', error);
      showError('Failed to update employee');
    }
  };

  const toggleSelection = (id) => {
    setSelectedTransactions(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions.map(t => t.id));
    }
  };

  const handleBulkApprove = async () => {
    if (!window.confirm(`Approve ${selectedTransactions.length} transactions and create entries?`)) {
      return;
    }

    try {
      const response = await transactionService.bulkApproveTransactions(selectedTransactions, {
        status: 'completed'
      });
      showSuccess(`Bulk approval completed: ${response.data.approved} approved, ${response.data.failed} failed`);
      loadData();
    } catch (error) {
      console.error('Bulk approve failed:', error);
      showError('Bulk approval failed');
    }
  };

  const handleBulkReject = async () => {
    const reason = prompt('Reason for bulk rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      const response = await transactionService.bulkRejectTransactions(selectedTransactions, reason);
      showSuccess(`Bulk rejection completed: ${response.data.rejected} rejected`);
      loadData();
    } catch (error) {
      console.error('Bulk reject failed:', error);
      showError('Bulk rejection failed');
    }
  };

  const getConfidenceBadge = (score) => {
    if (score === null || score === undefined) {
      return <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">N/A</span>;
    }

    if (score < 40) {
      return <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">🔴 {score}%</span>;
    } else if (score < 60) {
      return <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">🟡 {score}%</span>;
    } else if (score < 80) {
      return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">🟢 {score}%</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium rounded bg-green-200 text-green-900">✅ {score}%</span>;
    }
  };

  const formatCurrency = (amount, currency) => {
    return `${parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} ${currency}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handlePreviousPage = () => {
    setFilters(prev => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit)
    }));
  };

  const handleNextPage = () => {
    setFilters(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction Review</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review and approve Wise transactions requiring manual classification
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-800 font-medium">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pending_review || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-800 font-medium">Low Confidence</p>
                <p className="text-2xl font-bold text-red-900">{stats.low_confidence || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-800 font-medium">Approved Today</p>
                <p className="text-2xl font-bold text-green-900">{stats.approved_today || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-800 font-medium">Avg Confidence</p>
                <p className="text-2xl font-bold text-blue-900">
                  {stats.avg_confidence_score ? `${Math.round(stats.avg_confidence_score)}%` : 'N/A'}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          onClick={() => setFiltersVisible(!filtersVisible)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Filters</span>
          </div>
          {filtersVisible ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {filtersVisible && (
          <div className="p-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="processed">Processed</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
                <option value="all">All</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={filters.currency || ''}
                onChange={(e) => handleFilterChange('currency', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Currencies</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
              <select
                value={filters.transaction_type || ''}
                onChange={(e) => handleFilterChange('transaction_type', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="DEBIT">DEBIT (Expense)</option>
                <option value="CREDIT">CREDIT (Income)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Confidence</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.min_confidence || ''}
                onChange={(e) => handleFilterChange('min_confidence', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Confidence</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.max_confidence || ''}
                onChange={(e) => handleFilterChange('max_confidence', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => handleFilterChange('start_date', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => handleFilterChange('end_date', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.needs_review}
                  onChange={(e) => handleFilterChange('needs_review', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Needs Review Only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedTransactions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">{selectedTransactions.length} transactions selected</span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Approve Selected</span>
            </button>
            <button
              onClick={handleBulkReject}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject Selected</span>
            </button>
            <button
              onClick={() => setSelectedTransactions([])}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.length === transactions.length && transactions.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Merchant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                    No transactions found matching your filters
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.includes(transaction.id)}
                        onChange={() => toggleSelection(transaction.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{transaction.merchant_name || 'Unknown'}</div>
                      {transaction.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">{transaction.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        transaction.transaction_type === 'CREDIT'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={transaction.classified_category || ''}
                        onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        disabled={transaction.sync_status === 'processed'}
                      >
                        <option value="">Select category...</option>
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={transaction.matched_employee_id || ''}
                        onChange={(e) => handleEmployeeChange(transaction.id, e.target.value)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        disabled={transaction.sync_status === 'processed'}
                      >
                        <option value="">None</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {getConfidenceBadge(transaction.confidence_score)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        transaction.sync_status === 'processed'
                          ? 'bg-green-100 text-green-800'
                          : transaction.sync_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : transaction.sync_status === 'skipped'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transaction.sync_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {transaction.sync_status === 'pending' && !transaction.entry_id && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleApprove(transaction.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Approve and create entry"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(transaction.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Reject transaction"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {transaction.entry_id && (
                        <span className="text-xs text-gray-500">Entry #{transaction.entry_id}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} transactions
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handlePreviousPage}
              disabled={pagination.offset === 0}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!pagination.has_more}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
