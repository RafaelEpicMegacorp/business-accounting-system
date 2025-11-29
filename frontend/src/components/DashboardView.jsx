import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, FileText, Calendar, Briefcase, Upload, RefreshCw } from 'lucide-react';
import dashboardService from '../services/dashboardService';
import entryService from '../services/entryService';
import currencyService from '../services/currencyService';
import wiseService from '../services/wiseService';
import IncomeVsExpenseChart from './IncomeVsExpenseChart';
import CategoryBreakdownChart from './CategoryBreakdownChart';
import WiseImport from './WiseImport';

function DashboardView({ onNavigateToForecast }) {
  const [stats, setStats] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [currencyBalances, setCurrencyBalances] = useState([]);
  const [totalUSD, setTotalUSD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [chartRefreshTrigger, setChartRefreshTrigger] = useState(0);

  // Period selector state
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth'); // 'thisMonth', 'lastMonth', 'last3Months'
  const [thisMonthStats, setThisMonthStats] = useState(null);
  const [lastMonthStats, setLastMonthStats] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    loadMonthlyStats();
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get current and last month dates
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisMonth = now.getMonth() + 1;
      const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
      const lastMonthYear = thisMonth === 1 ? thisYear - 1 : thisYear;

      const [statsData, forecastData, currencyData, totalUSDData, thisMonthData, lastMonthData] = await Promise.all([
        dashboardService.getStats(),
        entryService.getForecast(),
        currencyService.getCurrencyBalances(),
        currencyService.getTotalBalanceInUSD(),
        dashboardService.getMonthlyStats(thisYear, thisMonth),
        dashboardService.getMonthlyStats(lastMonthYear, lastMonth)
      ]);
      setStats(statsData);
      setForecast(forecastData);
      setCurrencyBalances(currencyData);
      setTotalUSD(totalUSDData);
      setThisMonthStats(thisMonthData);
      setLastMonthStats(lastMonthData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyStats = async () => {
    // Additional loading for period selector if needed
    // Currently handled in loadDashboardData
  };

  const handleImportSuccess = () => {
    // Reload dashboard data after successful import
    loadDashboardData();
    // Trigger chart refresh
    setChartRefreshTrigger(prev => prev + 1);
  };

  const handleWiseSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);

      const result = await wiseService.syncFromWise();

      // Format success message with per-currency breakdown
      const stats = result.stats || {};
      const currencyBreakdown = stats.currencyBreakdown || {};

      let message = '';

      if (stats.newTransactions === 0 && stats.duplicatesSkipped > 0) {
        // All duplicates case
        message = `✅ Wise Sync Complete\nAll transactions up to date (${stats.duplicatesSkipped} duplicates skipped)`;
      } else if (stats.newTransactions > 0) {
        // New transactions case - show per-currency breakdown
        const currencyFlags = {
          'USD': '🇺🇸',
          'EUR': '🇪🇺',
          'PLN': '🇵🇱',
          'GBP': '🇬🇧'
        };

        message = '✅ Wise Sync Complete\n';
        Object.keys(currencyBreakdown).forEach(currency => {
          const cb = currencyBreakdown[currency];
          if (cb.newTransactions > 0) {
            const flag = currencyFlags[currency] || '💱';
            const formattedBalance = cb.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            message += `\n${flag} ${currency}: ${cb.newTransactions} new transaction${cb.newTransactions > 1 ? 's' : ''} (${formattedBalance} ${currency})`;
          }
        });
        message += `\n\nTotal: ${stats.newTransactions} transaction${stats.newTransactions > 1 ? 's' : ''} imported`;
      } else {
        // Fallback message
        message = `Sync completed: ${stats.newTransactions || 0} new transactions, ${stats.duplicatesSkipped || 0} duplicates skipped`;
      }

      setSyncMessage({ type: 'success', text: message });

      // Reload dashboard data
      loadDashboardData();

      // Trigger chart refresh
      setChartRefreshTrigger(prev => prev + 1);

      // Clear message after 15 seconds (longer to read detailed breakdown)
      setTimeout(() => setSyncMessage(null), 15000);
    } catch (error) {
      console.error('Sync failed:', error);

      // Check if error is SCA authentication requirement
      if (error.response?.status === 403 && error.response?.data?.requiresSCA) {
        const data = error.response.data;
        const instructions = data.instructions || [];

        // Format SCA message with clear instructions
        let scaMessage = `🔐 ${data.message}\n\n`;
        scaMessage += instructions.join('\n');

        if (data.currency) {
          scaMessage += `\n\nCurrency: ${data.currency}`;
        }

        setSyncMessage({ type: 'sca', text: scaMessage });

        // Don't auto-clear SCA messages - user needs time to approve
        return;
      }

      const errorMsg = error.response?.data?.error || error.message || 'Failed to sync from Wise';
      setSyncMessage({ type: 'error', text: errorMsg });

      // Clear error after 10 seconds
      setTimeout(() => setSyncMessage(null), 10000);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats || !forecast) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load dashboard data</div>
      </div>
    );
  }

  // Use total USD balance from Wise accounts
  const currentBalance = totalUSD ? parseFloat(totalUSD.total_usd) : 0;

  const weeklyPayments = parseFloat(forecast.weekly_payments || 0);
  const monthlyPayments = parseFloat(forecast.monthly_payments || 0);
  const totalExpenses = weeklyPayments + monthlyPayments;

  // Calculate forecast using ONLY Wise balance (no contract income)
  const forecastBalance = currentBalance - totalExpenses;

  // Monthly stats for display
  const currentMonthIncome = thisMonthStats?.income || 0;
  const currentMonthExpenses = thisMonthStats?.expenses || 0;
  const currentMonthProfit = thisMonthStats?.profit || 0;
  const lastMonthIncome = lastMonthStats?.income || 0;
  const lastMonthExpenses = lastMonthStats?.expenses || 0;
  const lastMonthProfit = lastMonthStats?.profit || 0;

  // Get month names for display
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const thisMonthName = monthNames[now.getMonth()];
  const lastMonthName = monthNames[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

  // Get selected period stats
  const getSelectedPeriodStats = () => {
    if (selectedPeriod === 'thisMonth') return thisMonthStats;
    if (selectedPeriod === 'lastMonth') return lastMonthStats;
    return thisMonthStats; // default
  };
  const periodStats = getSelectedPeriodStats();

  return (
    <div className="space-y-6">
      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Wise Balance */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium opacity-90">Total Wise Balance</h3>
            <DollarSign size={24} className="opacity-80" />
          </div>
          <p className="text-3xl font-bold">
            ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 border-t border-blue-400 opacity-90">
            {totalUSD && totalUSD.breakdown && totalUSD.breakdown.map((item, index) => (
              <div key={index} className="flex justify-between text-sm mt-1">
                <span>{item.currency}:</span>
                <span>${item.usd_equivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* End-of-Month Forecast */}
        <div
          onClick={onNavigateToForecast}
          className={`${forecastBalance >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:scale-105`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium opacity-90">End-of-Month Forecast</h3>
            <Calendar size={24} className="opacity-80" />
          </div>
          <p className="text-3xl font-bold">
            {forecastBalance < 0 && '-'}${Math.abs(forecastBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 opacity-90">
            <div className="text-sm mb-1 opacity-70">Wise Balance - Remaining Expenses</div>
            <div className="flex justify-between text-sm">
              <span>Weekly due:</span>
              <span>-${weeklyPayments.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Monthly due:</span>
              <span>-${monthlyPayments.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-2 text-xs opacity-70 text-center">
            Click to see detailed breakdown
          </div>
        </div>

        {/* This Month Cash Flow */}
        <div className={`${currentMonthProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-orange-500 to-orange-600'} text-white rounded-lg shadow-lg p-6`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium opacity-90">{thisMonthName} Cash Flow</h3>
            <TrendingUp size={24} className="opacity-80" />
          </div>
          <p className="text-3xl font-bold">
            {currentMonthProfit < 0 && '-'}${Math.abs(currentMonthProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 opacity-90">
            <div className="flex justify-between text-sm">
              <span>Income:</span>
              <span className={currentMonthIncome === 0 ? 'text-yellow-200' : 'text-green-200'}>
                ${currentMonthIncome.toLocaleString()}
                {currentMonthIncome === 0 && currentMonthExpenses > 0 && ' (!!)'}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Expenses:</span>
              <span className="text-red-200">-${currentMonthExpenses.toLocaleString()}</span>
            </div>
            {currentMonthIncome === 0 && currentMonthExpenses > 0 && (
              <div className="text-xs text-yellow-200 mt-2 text-center">
                No income recorded - Sync Wise
              </div>
            )}
            <div className="flex justify-between text-sm mt-2 opacity-70">
              <span>{lastMonthName}:</span>
              <span className={lastMonthProfit >= 0 ? 'text-green-200' : 'text-red-200'}>
                {lastMonthProfit < 0 && '-'}${Math.abs(lastMonthProfit).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wise Currency Balances */}
      {currencyBalances && currencyBalances.length > 0 && (
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg shadow-lg p-6 border border-teal-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign size={24} className="text-teal-700" />
              <h3 className="text-xl font-bold text-teal-900">Wise Account Balances</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleWiseSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync Wise History'}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition shadow-md"
              >
                <Upload size={18} />
                Import CSV
              </button>
            </div>
          </div>

          {/* Sync Message */}
          {syncMessage && (
            <div className={`mb-4 p-4 rounded-lg ${
              syncMessage.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : syncMessage.type === 'sca'
                ? 'bg-blue-100 text-blue-900 border border-blue-400'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
              <div className="whitespace-pre-line font-mono text-sm">
                {syncMessage.text}
              </div>
              {syncMessage.type === 'sca' && (
                <button
                  onClick={() => setSyncMessage(null)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currencyBalances.map((balance) => {
              const amount = parseFloat(balance.balance);
              const currencyFlags = {
                'USD': '🇺🇸',
                'PLN': '🇵🇱',
                'EUR': '🇪🇺',
                'GBP': '🇬🇧'
              };

              return (
                <div key={balance.currency} className="bg-white rounded-lg p-5 border-2 border-teal-200 shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{currencyFlags[balance.currency] || '💱'}</span>
                      <span className="text-lg font-bold text-gray-700">{balance.currency}</span>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-teal-700">
                    {amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Last updated: {new Date(balance.last_updated).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Salaries Paid */}
        <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-600">Salaries Paid</h4>
            <TrendingDown size={18} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${parseFloat(stats.salaries_paid).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-2">{stats.salary_entries_count} payments</p>
        </div>

        {/* Salaries Pending */}
        <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-600">Salaries Pending</h4>
            <Calendar size={18} className="text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${parseFloat(stats.salaries_pending).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-2">Upcoming</p>
        </div>

        {/* Active Employees */}
        <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-600">Active Employees</h4>
            <Users size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.active_employees}
          </p>
          <p className="text-xs text-gray-500 mt-2">Team members</p>
        </div>

        {/* Pending Income */}
        <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-600">Pending Income</h4>
            <TrendingUp size={18} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${parseFloat(stats.pending_income).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-2">Scheduled</p>
        </div>
      </div>

      {/* Expenses Breakdown with Period Selector */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Expenses by Category</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriod('thisMonth')}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                selectedPeriod === 'thisMonth'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {thisMonthName}
            </button>
            <button
              onClick={() => setSelectedPeriod('lastMonth')}
              className={`px-4 py-2 text-sm rounded-lg transition ${
                selectedPeriod === 'lastMonth'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {lastMonthName}
            </button>
          </div>
        </div>

        {/* Period Summary */}
        {periodStats && (
          <div className="space-y-4 mb-6">
            {periodStats.income === 0 && periodStats.expenses > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
                No income recorded for this period. Click "Sync Wise History" above to import transactions.
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded border ${periodStats.income === 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-200'}`}>
                <p className={`text-sm font-medium ${periodStats.income === 0 ? 'text-yellow-700' : 'text-green-700'}`}>Income</p>
                <p className={`text-2xl font-bold ${periodStats.income === 0 ? 'text-yellow-800' : 'text-green-800'}`}>${periodStats.income.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-red-50 rounded border border-red-200">
                <p className="text-sm font-medium text-red-700">Expenses</p>
                <p className="text-2xl font-bold text-red-800">${periodStats.expenses.toLocaleString()}</p>
              </div>
              <div className={`p-4 rounded border ${periodStats.profit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                <p className={`text-sm font-medium ${periodStats.profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Cash Flow</p>
                <p className={`text-2xl font-bold ${periodStats.profit >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                  {periodStats.profit < 0 && '-'}${Math.abs(periodStats.profit).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {periodStats?.expenses_by_category && periodStats.expenses_by_category.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {periodStats.expenses_by_category.map((expense, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs font-medium text-gray-600 truncate">{expense.category}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  ${parseFloat(expense.total).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No expenses for this period</p>
        )}
      </div>

      {/* Contract Details */}
      {forecast.contract_details && forecast.contract_details.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={20} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Contract Payments</h3>
          </div>
          <div className="space-y-2">
            {forecast.contract_details.map((contract, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-purple-50 rounded border border-purple-200">
                <div>
                  <p className="font-medium text-gray-900">{contract.client_name}</p>
                  <p className="text-sm text-gray-600">Payment on day {contract.payment_day}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-700">
                    ${parseFloat(contract.amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600">{contract.payment_date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeVsExpenseChart months={12} refreshTrigger={chartRefreshTrigger} />
        <CategoryBreakdownChart refreshTrigger={chartRefreshTrigger} />
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <WiseImport
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}

export default DashboardView;
