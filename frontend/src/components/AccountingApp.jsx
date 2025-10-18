import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, DollarSign, TrendingUp, TrendingDown, CheckSquare, Square, Download, X, Filter, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import entryService from '../services/entryService';
import contractService from '../services/contractService';
import currencyService from '../services/currencyService';
import EmployeeList from './EmployeeList';
import EmployeeForm from './EmployeeForm';
import ContractList from './ContractList';
import ContractForm from './ContractForm';
import DashboardView from './DashboardView';
import SalaryCalendar from './SalaryCalendar';
import WiseReviewQueue from './WiseReviewQueue';
import { exportEntriesToCSV, exportEmployeesToCSV, exportContractsToCSV } from '../utils/csvExport';

export default function AccountingApp() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'income', 'expenses', 'salaries', 'employees', 'contracts', or 'wise'
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({
    total_income: '0',
    total_expenses: '0',
    net_balance: '0',
    pending_income: '0',
    pending_expenses: '0'
  });
  const [forecast, setForecast] = useState({
    current_balance: '0',
    weekly_payments: '0',
    monthly_payments: '0',
    total_forecasted_expenses: '0',
    forecasted_balance: '0',
    weeks_remaining: 0,
    days_remaining: 0
  });
  const [totalUSD, setTotalUSD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    category: 'Employee',
    description: '',
    detail: '',
    baseAmount: '',
    total: '',
    entryDate: new Date().toISOString().split('T')[0],
    status: 'completed'
  });

  // Bulk selection state
  const [selectedEntries, setSelectedEntries] = useState([]);

  // Date filtering state
  const [dateFilters, setDateFilters] = useState({ startDate: '', endDate: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Employee management state
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Contract management state
  const [contracts, setContracts] = useState([]);
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);

  const categories = ['Employee', 'Administration', 'Software', 'Marketing', 'Equipment', 'Other'];

  // Load entries on mount and when view or filters change
  useEffect(() => {
    loadEntries();
  }, [currentView, dateFilters]);

  const loadEntries = async () => {
    try {
      setLoading(true);

      // Load data based on current view with date filters
      let entriesData;
      if (currentView === 'dashboard') {
        entriesData = [];
      } else if (currentView === 'income') {
        entriesData = await entryService.getIncome(dateFilters);
      } else if (currentView === 'expenses') {
        entriesData = await entryService.getExpenses(dateFilters);
      } else if (currentView === 'salaries') {
        entriesData = await entryService.getSalaries(dateFilters);
      } else if (currentView === 'contracts') {
        entriesData = [];
        const contractsData = await contractService.getAll();
        setContracts(contractsData);
      } else {
        entriesData = [];
      }

      const [totalsData, forecastData, totalUSDData] = await Promise.all([
        entryService.getTotals(),
        entryService.getForecast(),
        currencyService.getTotalBalanceInUSD()
      ]);

      setEntries(entriesData);
      setTotals(totalsData);
      setForecast(forecastData);
      setTotalUSD(totalUSDData);
      setSelectedEntries([]); // Clear selections on reload
      setError(null);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.description || !formData.baseAmount || !formData.total) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingId) {
        await entryService.update(editingId, formData);
      } else {
        await entryService.create(formData);
      }
      await loadEntries();
      resetForm();
    } catch (err) {
      alert('Failed to save entry. Please try again.');
      console.error('Save error:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'expense',
      category: 'Employee',
      description: '',
      detail: '',
      baseAmount: '',
      total: '',
      entryDate: new Date().toISOString().split('T')[0],
      status: 'completed'
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (entry) => {
    setFormData({
      type: entry.type,
      category: entry.category,
      description: entry.description,
      detail: entry.detail || '',
      baseAmount: entry.base_amount,
      total: entry.total,
      entryDate: entry.entry_date.split('T')[0],
      status: entry.status || 'completed'
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await entryService.delete(id);
        await loadEntries();
      } catch (err) {
        alert('Failed to delete entry. Please try again.');
        console.error('Delete error:', err);
      }
    }
  };

  // Calculate totals from completed entries only
  // Use totals from API (includes auto-calculation for past pending entries)
  const totalIncome = parseFloat(totals.total_income || 0);
  const totalExpenses = parseFloat(totals.total_expenses || 0);

  // Use Wise balance instead of business balance
  const wiseBalance = totalUSD ? parseFloat(totalUSD.total_usd) : 0;

  // Forecast data
  const weeklyPayments = parseFloat(forecast.weekly_payments || 0);
  const monthlyPayments = parseFloat(forecast.monthly_payments || 0);
  const totalForecastedExpenses = parseFloat(forecast.total_forecasted_expenses || 0);
  const forecastedBalance = parseFloat(forecast.forecasted_balance || 0);

  // Calculate income-specific statistics
  const incomeStats = React.useMemo(() => {
    if (currentView !== 'income' || entries.length === 0) return null;

    const completedIncome = entries
      .filter(e => e.status === 'completed')
      .reduce((sum, e) => sum + parseFloat(e.total), 0);

    const pendingIncome = entries
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + parseFloat(e.total), 0);

    const totalIncome = entries.reduce((sum, e) => sum + parseFloat(e.total), 0);

    // Group by category
    const byCategory = entries.reduce((acc, e) => {
      const cat = e.category || 'Other';
      acc[cat] = (acc[cat] || 0) + parseFloat(e.total);
      return acc;
    }, {});

    const topCategory = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])[0];

    // Calculate this month's income
    const now = new Date();
    const thisMonth = entries
      .filter(e => {
        const entryDate = new Date(e.entry_date);
        return entryDate.getMonth() === now.getMonth() &&
               entryDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + parseFloat(e.total), 0);

    return {
      completed: completedIncome,
      pending: pendingIncome,
      total: totalIncome,
      count: entries.length,
      average: totalIncome / entries.length,
      thisMonth,
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null
    };
  }, [entries, currentView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold text-xl mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadEntries}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleEmployeeEdit = (employee = null) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleEmployeeFormClose = () => {
    setShowEmployeeForm(false);
    setEditingEmployee(null);
  };

  // Contract handlers
  const handleContractEdit = (contract = null) => {
    setEditingContract(contract);
    setShowContractForm(true);
  };

  const handleContractSave = async (contractData) => {
    try {
      if (editingContract) {
        await contractService.update(editingContract.id, contractData);
      } else {
        await contractService.create(contractData);
      }
      await loadEntries();
      setShowContractForm(false);
      setEditingContract(null);
    } catch (err) {
      alert('Failed to save contract. Please try again.');
      console.error('Contract save error:', err);
    }
  };

  const handleContractDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this contract?')) {
      try {
        await contractService.delete(id);
        await loadEntries();
      } catch (err) {
        alert('Failed to delete contract. Please try again.');
        console.error('Contract delete error:', err);
      }
    }
  };

  // Bulk selection handlers
  const toggleEntrySelection = (id) => {
    setSelectedEntries(prev =>
      prev.includes(id) ? prev.filter(entryId => entryId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEntries.length === entries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(entries.map(e => e.id));
    }
  };

  const handleBulkDelete = async () => {
    // Count contract entries in selection
    const contractEntries = entries.filter(e => selectedEntries.includes(e.id) && e.contract_id);
    const warningMessage = contractEntries.length > 0
      ? `Are you sure you want to delete ${selectedEntries.length} entries?\n\nThis includes ${contractEntries.length} contract-generated entries. These entries can be regenerated from the Contracts tab if needed.`
      : `Are you sure you want to delete ${selectedEntries.length} entries?`;

    if (!window.confirm(warningMessage)) {
      return;
    }

    try {
      const result = await entryService.bulkDelete(selectedEntries);
      if (result.failed.length > 0) {
        alert(`Deleted ${result.affected} entries. Failed to delete ${result.failed.length} entries:\n${result.failed.map(f => `ID ${f.id}: ${f.reason}`).join('\n')}`);
      } else {
        alert(`Successfully deleted ${result.affected} entries.`);
      }
      await loadEntries();
    } catch (err) {
      alert('Failed to delete entries. Please try again.');
      console.error('Bulk delete error:', err);
    }
  };

  const handleBulkUpdateStatus = async (status) => {
    if (!window.confirm(`Are you sure you want to mark ${selectedEntries.length} entries as ${status}?`)) {
      return;
    }

    try {
      const result = await entryService.bulkUpdateStatus(selectedEntries, status);
      if (result.failed.length > 0) {
        alert(`Updated ${result.affected} entries. Failed to update ${result.failed.length} entries:\n${result.failed.map(f => `ID ${f.id}: ${f.reason}`).join('\n')}`);
      } else {
        alert(`Successfully updated ${result.affected} entries to ${status}.`);
      }
      await loadEntries();
    } catch (err) {
      alert('Failed to update entries. Please try again.');
      console.error('Bulk update error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Accounting</h1>
              <p className="text-gray-600 mt-1">Track your income, expenses, and employees</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Logged in as</p>
                <p className="font-medium text-gray-900">{user?.name || user?.username}</p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
            <div className="hidden">{/* Spacer for original button layout */}</div>
            {(currentView === 'income' || currentView === 'expenses' || currentView === 'salaries') && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <Plus size={20} />
                Add Entry
              </button>
            )}
            {currentView === 'contracts' && (
              <button
                onClick={() => handleContractEdit(null)}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
              >
                <Plus size={20} />
                Add Contract
              </button>
            )}
            {currentView === 'dashboard' && (
              <div className="text-sm text-gray-600">
                Overview of all metrics and forecasts
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-4 py-2 font-medium transition ${
                currentView === 'dashboard'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('income')}
              className={`px-4 py-2 font-medium transition ${
                currentView === 'income'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setCurrentView('expenses')}
              className={`px-4 py-2 font-medium transition ${
                currentView === 'expenses'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setCurrentView('salaries')}
              className={`px-4 py-2 font-medium transition ${
                currentView === 'salaries'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Salaries
            </button>
            <button
              onClick={() => setCurrentView('contracts')}
              className={`px-4 py-2 font-medium transition ${
                currentView === 'contracts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Contracts
            </button>
            <button
              onClick={() => setCurrentView('employees')}
              className={`px-4 py-2 font-medium transition ${
                currentView === 'employees'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Employees
            </button>
            <button
              onClick={() => setCurrentView('wise')}
              className={`px-4 py-2 font-medium transition ${
                currentView === 'wise'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Wise Sync
            </button>
          </div>

          {(currentView === 'income' || currentView === 'expenses' || currentView === 'salaries') && (
            <>
              {/* Filters and Export Toolbar */}
              <div className="flex flex-wrap items-center gap-3 mt-6 mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <Filter size={18} />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>

                <button
                  onClick={() => exportEntriesToCSV(entries)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Download size={18} />
                  Export to CSV
                </button>

                {(dateFilters.startDate || dateFilters.endDate) && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    <span className="font-medium">Active Filters:</span>
                    {dateFilters.startDate && <span>From: {new Date(dateFilters.startDate).toLocaleDateString()}</span>}
                    {dateFilters.endDate && <span>To: {new Date(dateFilters.endDate).toLocaleDateString()}</span>}
                    <button
                      onClick={() => setDateFilters({ startDate: '', endDate: '' })}
                      className="ml-2 p-1 hover:bg-blue-100 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Date Range Filters */}
              {showFilters && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter by Date Range</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={dateFilters.startDate}
                        onChange={(e) => setDateFilters({ ...dateFilters, startDate: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={dateFilters.endDate}
                        onChange={(e) => setDateFilters({ ...dateFilters, endDate: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => setDateFilters({ startDate: '', endDate: '' })}
                        className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Income-Specific Widgets */}
              {currentView === 'income' && incomeStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Total Income */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium">Total Income</p>
                        <p className="text-xs text-green-500 mt-0.5">{incomeStats.count} entries</p>
                        <p className="text-2xl font-bold text-green-700 mt-1">
                          ${incomeStats.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <DollarSign className="text-green-600" size={32} />
                    </div>
                  </div>

                  {/* This Month */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium">This Month</p>
                        <p className="text-xs text-blue-500 mt-0.5">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                        <p className="text-2xl font-bold text-blue-700 mt-1">
                          ${incomeStats.thisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <TrendingUp className="text-blue-600" size={32} />
                    </div>
                  </div>

                  {/* Completed vs Pending */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-600 font-medium">Completed</p>
                        <p className="text-xs text-purple-500 mt-0.5">Pending: ${incomeStats.pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <p className="text-2xl font-bold text-purple-700 mt-1">
                          ${incomeStats.completed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <TrendingUp className="text-purple-600" size={32} />
                    </div>
                  </div>

                  {/* Top Category */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-amber-600 font-medium">Top Category</p>
                        <p className="text-xs text-amber-500 mt-0.5">{incomeStats.topCategory?.name || 'N/A'}</p>
                        <p className="text-2xl font-bold text-amber-700 mt-1">
                          ${(incomeStats.topCategory?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <DollarSign className="text-amber-600" size={32} />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Summary Cards - Income tab shows only Wise Balance when no income stats */}
              {currentView === 'income' && !incomeStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                  <div className="bg-blue-50 border-blue-200 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">
                          Total Wise Balance
                        </p>
                        <p className="text-xs text-blue-500 mt-0.5">All currencies in USD</p>
                        <p className="text-2xl font-bold mt-1 text-blue-700">
                          ${wiseBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        {totalUSD && totalUSD.breakdown && (
                          <div className="mt-2 text-xs text-blue-600">
                            {totalUSD.breakdown.map((item, index) => (
                              <div key={index}>
                                {item.currency}: ${item.usd_equivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <DollarSign className="text-blue-600" size={32} />
                    </div>
                  </div>
                </div>
              )}

              {/* Expenses tab shows Actual Expenses + Wise Balance */}
              {currentView === 'expenses' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600 font-medium">Actual Expenses</p>
                        <p className="text-xs text-red-500 mt-0.5">Paid</p>
                        <p className="text-2xl font-bold text-red-700 mt-1">
                          ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <TrendingDown className="text-red-600" size={32} />
                    </div>
                  </div>

                  <div className="bg-blue-50 border-blue-200 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">
                          Total Wise Balance
                        </p>
                        <p className="text-xs text-blue-500 mt-0.5">All currencies in USD</p>
                        <p className="text-2xl font-bold mt-1 text-blue-700">
                          ${wiseBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        {totalUSD && totalUSD.breakdown && (
                          <div className="mt-2 text-xs text-blue-600">
                            {totalUSD.breakdown.map((item, index) => (
                              <div key={index}>
                                {item.currency}: ${item.usd_equivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <DollarSign className="text-blue-600" size={32} />
                    </div>
                  </div>
                </div>
              )}

              {/* Salaries tab shows all 4 general summary cards */}
              {currentView === 'salaries' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium">Actual Income</p>
                        <p className="text-xs text-green-500 mt-0.5">Received</p>
                        <p className="text-2xl font-bold text-green-700 mt-1">
                          ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <TrendingUp className="text-green-600" size={32} />
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600 font-medium">Actual Expenses</p>
                        <p className="text-xs text-red-500 mt-0.5">Paid</p>
                        <p className="text-2xl font-bold text-red-700 mt-1">
                          ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <TrendingDown className="text-red-600" size={32} />
                    </div>
                  </div>

                  <div className="bg-blue-50 border-blue-200 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">
                          Total Wise Balance
                        </p>
                        <p className="text-xs text-blue-500 mt-0.5">All currencies in USD</p>
                        <p className="text-2xl font-bold mt-1 text-blue-700">
                          ${wiseBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        {totalUSD && totalUSD.breakdown && (
                          <div className="mt-2 text-xs text-blue-600">
                            {totalUSD.breakdown.map((item, index) => (
                              <div key={index}>
                                {item.currency}: ${item.usd_equivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <DollarSign className="text-blue-600" size={32} />
                    </div>
                  </div>

                  <div className={`${forecastedBalance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${forecastedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          End-of-Month Forecast
                        </p>
                        <p className={`text-xs ${forecastedBalance >= 0 ? 'text-green-500' : 'text-red-500'} mt-0.5`}>
                          {forecast.weeks_remaining} weeks remaining
                        </p>
                        <p className={`text-2xl font-bold mt-1 ${forecastedBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          ${forecastedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="mt-2 text-xs text-gray-600">
                          <div>Weekly: ${weeklyPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div>Monthly: ${monthlyPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                      <DollarSign className={forecastedBalance >= 0 ? 'text-green-600' : 'text-red-600'} size={32} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <DashboardView />
        )}

        {/* Employee View */}
        {currentView === 'employees' && (
          <EmployeeList
            onEmployeeSelect={null}
            onEdit={handleEmployeeEdit}
          />
        )}

        {/* Contracts View */}
        {currentView === 'contracts' && (
          <ContractList
            contracts={contracts}
            onEdit={handleContractEdit}
            onDelete={handleContractDelete}
          />
        )}

        {/* Wise Sync View */}
        {currentView === 'wise' && (
          <WiseReviewQueue />
        )}

        {/* Employee Form Modal */}
        {showEmployeeForm && (
          <EmployeeForm
            employee={editingEmployee}
            onClose={handleEmployeeFormClose}
            onSuccess={loadEntries}
          />
        )}

        {/* Contract Form Modal */}
        {showContractForm && (
          <ContractForm
            contract={editingContract}
            onSave={handleContractSave}
            onCancel={() => {
              setShowContractForm(false);
              setEditingContract(null);
            }}
          />
        )}

        {(currentView === 'income' || currentView === 'expenses' || currentView === 'salaries') && (
          <>
            {/* Entry Form with Date Picker */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Entry' : 'Add New Entry'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="completed">Completed (Received/Paid)</option>
                    <option value="pending">Pending (Scheduled)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., John Doe, Office Rent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Detail (optional)</label>
                  <input
                    type="text"
                    value={formData.detail}
                    onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Additional details"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.baseAmount}
                    onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total (with taxes/fees)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total}
                    onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {editingId ? 'Update Entry' : 'Add Entry'}
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Salary Calendar View */}
        {currentView === 'salaries' ? (
          <SalaryCalendar
            entries={entries}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : (
          <>
            {/* Bulk Actions Toolbar */}
            {selectedEntries.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                <span className="text-blue-700 font-medium">{selectedEntries.length} entries selected</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkUpdateStatus('completed')}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
                  >
                    Mark Completed
                  </button>
                  <button
                    onClick={() => handleBulkUpdateStatus('pending')}
                    className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 text-sm"
                  >
                    Mark Pending
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={() => setSelectedEntries([])}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Entries Table with Date Column */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button onClick={toggleSelectAll} className="hover:text-gray-700">
                      {selectedEntries.length === entries.length && entries.length > 0 ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button onClick={() => toggleEntrySelection(entry.id)} className="hover:text-blue-600">
                        {selectedEntries.includes(entry.id) ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.status === 'completed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {entry.status === 'completed' ? '✓ Completed' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.type === 'income'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.category}
                      {entry.contract_id && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Contract
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{entry.detail}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${parseFloat(entry.base_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      ${parseFloat(entry.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {entry.contract_id ? (
                        <span className="text-gray-400 text-xs">Contract-generated</span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(entry)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
