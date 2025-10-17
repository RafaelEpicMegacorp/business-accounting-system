import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../services/api';

const WiseReviewQueue = () => {
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    category: '',
    employeeId: null
  });
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState(null);

  // Fetch pending transactions
  const fetchPendingTransactions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/wise/pending-review');
      setPendingTransactions(response.data);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
      setMessage({ type: 'error', text: 'Failed to load pending transactions' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await api.get('/wise/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch employees for dropdown
  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees/active');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPendingTransactions();
    fetchStats();
    fetchEmployees();
  }, []);

  // Manual sync
  const handleManualSync = async (days = 7) => {
    try {
      setSyncing(true);
      setMessage({ type: 'info', text: `Syncing last ${days} days...` });

      const response = await api.get(`/wise/sync?days=${days}`);

      setMessage({
        type: 'success',
        text: response.data.message
      });

      // Refresh data
      await Promise.all([fetchPendingTransactions(), fetchStats()]);
    } catch (error) {
      console.error('Error syncing:', error);
      setMessage({ type: 'error', text: 'Failed to sync transactions' });
    } finally {
      setSyncing(false);
    }
  };

  // Open review modal
  const openReviewModal = (transaction) => {
    setSelectedTransaction(transaction);
    setReviewForm({
      category: transaction.classified_category || '',
      employeeId: transaction.matched_employee_id || null
    });
  };

  // Close review modal
  const closeReviewModal = () => {
    setSelectedTransaction(null);
    setReviewForm({ category: '', employeeId: null });
  };

  // Approve transaction
  const handleApprove = async () => {
    if (!selectedTransaction) return;

    try {
      await api.post(`/wise/review/${selectedTransaction.id}`, {
        action: 'approve',
        category: reviewForm.category,
        employeeId: reviewForm.employeeId
      });

      setMessage({ type: 'success', text: 'Transaction approved and entry created' });

      closeReviewModal();
      await Promise.all([fetchPendingTransactions(), fetchStats()]);
    } catch (error) {
      console.error('Error approving transaction:', error);
      setMessage({ type: 'error', text: 'Failed to approve transaction' });
    }
  };

  // Skip transaction
  const handleSkip = async () => {
    if (!selectedTransaction) return;

    try {
      await api.post(`/wise/review/${selectedTransaction.id}`, {
        action: 'skip'
      });

      setMessage({ type: 'success', text: 'Transaction skipped' });

      closeReviewModal();
      await Promise.all([fetchPendingTransactions(), fetchStats()]);
    } catch (error) {
      console.error('Error skipping transaction:', error);
      setMessage({ type: 'error', text: 'Failed to skip transaction' });
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get confidence color
  const getConfidenceColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Wise Transaction Sync</h2>
        <div className="space-x-2">
          <button
            onClick={() => handleManualSync(7)}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Last 7 Days
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded ${
          message.type === 'success' ? 'bg-green-100 text-green-800' :
          message.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {message.type === 'error' && <XCircle className="w-5 h-5" />}
            {message.type === 'info' && <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Total Transactions</div>
            <div className="text-3xl font-bold mt-2">{stats.total_transactions}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6">
            <div className="text-sm text-yellow-800">Needs Review</div>
            <div className="text-3xl font-bold mt-2 text-yellow-600">{stats.needs_review_count}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="text-sm text-green-800">Processed</div>
            <div className="text-3xl font-bold mt-2 text-green-600">{stats.processed_count}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="text-sm text-blue-800">Avg Confidence</div>
            <div className="text-3xl font-bold mt-2 text-blue-600">
              {stats.avg_confidence_score ? `${parseFloat(stats.avg_confidence_score).toFixed(0)}%` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Pending Transactions Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Pending Review ({pendingTransactions.length})</h3>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-600 mt-2">Loading transactions...</p>
            </div>
          ) : pendingTransactions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
              <p className="text-gray-600">No transactions pending review!</p>
              <p className="text-sm text-gray-500 mt-1">All Wise transactions have been processed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Description</th>
                    <th className="text-right py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Category</th>
                    <th className="text-center py-3 px-4">Confidence</th>
                    <th className="text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        {formatDate(transaction.transaction_date)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          transaction.type === 'CREDIT'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type === 'CREDIT' ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {transaction.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div>{transaction.description || 'No description'}</div>
                        {transaction.merchant_name && (
                          <div className="text-xs text-gray-500">{transaction.merchant_name}</div>
                        )}
                        {transaction.employee_name && (
                          <div className="text-xs text-blue-600">Matched: {transaction.employee_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
                          {transaction.classified_category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-semibold ${getConfidenceColor(transaction.confidence_score)}`}>
                          {transaction.confidence_score}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openReviewModal(transaction)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">Review Transaction</h3>

              {/* Transaction Details */}
              <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{formatDate(selectedTransaction.transaction_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className={`font-medium ${
                    selectedTransaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedTransaction.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Description:</span>
                  <span className="font-medium">{selectedTransaction.description || 'N/A'}</span>
                </div>
                {selectedTransaction.merchant_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Merchant:</span>
                    <span className="font-medium">{selectedTransaction.merchant_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Confidence Score:</span>
                  <span className={`font-semibold ${getConfidenceColor(selectedTransaction.confidence_score)}`}>
                    {selectedTransaction.confidence_score}%
                  </span>
                </div>
              </div>

              {/* Review Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={reviewForm.category}
                    onChange={(e) => setReviewForm({ ...reviewForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    <option value="Employee">Employee (Salary)</option>
                    <option value="Software">Software</option>
                    <option value="Administration">Administration</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Professional Services">Professional Services</option>
                    <option value="Bank Fees">Bank Fees</option>
                    <option value="Client Payment">Client Payment</option>
                    <option value="Other Income">Other Income</option>
                    <option value="Other Expenses">Other Expenses</option>
                  </select>
                </div>

                {reviewForm.category === 'Employee' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Employee</label>
                    <select
                      value={reviewForm.employeeId || ''}
                      onChange={(e) => setReviewForm({ ...reviewForm, employeeId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select employee...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.pay_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleApprove}
                  disabled={!reviewForm.category}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve & Create Entry
                </button>
                <button
                  onClick={handleSkip}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Skip Transaction
                </button>
                <button
                  onClick={closeReviewModal}
                  className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WiseReviewQueue;
