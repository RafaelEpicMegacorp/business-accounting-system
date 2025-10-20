import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, FileText, Calendar, Briefcase } from 'lucide-react';
import dashboardService from '../services/dashboardService';
import entryService from '../services/entryService';
import currencyService from '../services/currencyService';
import IncomeVsExpenseChart from './IncomeVsExpenseChart';
import CategoryBreakdownChart from './CategoryBreakdownChart';

function DashboardView({ onNavigateToForecast }) {
  const [stats, setStats] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [currencyBalances, setCurrencyBalances] = useState([]);
  const [totalUSD, setTotalUSD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, forecastData, currencyData, totalUSDData] = await Promise.all([
        dashboardService.getStats(),
        entryService.getForecast(),
        currencyService.getCurrencyBalances(),
        currencyService.getTotalBalanceInUSD()
      ]);
      setStats(statsData);
      setForecast(forecastData);
      setCurrencyBalances(currencyData);
      setTotalUSD(totalUSDData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
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

  const contractIncome = parseFloat(forecast.contract_income || 0);
  const weeklyPayments = parseFloat(forecast.weekly_payments);
  const monthlyPayments = parseFloat(forecast.monthly_payments);
  const totalExpenses = weeklyPayments + monthlyPayments;

  // Calculate forecast on frontend using correct balance from totalUSD (same as ForecastView)
  const forecastBalance = currentBalance + contractIncome - totalExpenses;

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
            ${Math.abs(forecastBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 border-t border-white border-opacity-30 opacity-90">
            <div className="text-sm mb-1">{forecast.weeks_remaining} weeks remaining</div>
            <div className="flex justify-between text-sm">
              <span>Weekly:</span>
              <span>${weeklyPayments.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Monthly:</span>
              <span>${monthlyPayments.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-2 text-xs opacity-70 text-center">
            Click to see detailed breakdown
          </div>
        </div>

        {/* Monthly Recurring Revenue */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium opacity-90">Monthly Recurring Revenue</h3>
            <Briefcase size={24} className="opacity-80" />
          </div>
          <p className="text-3xl font-bold">
            ${parseFloat(stats.monthly_recurring_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 border-t border-purple-400 opacity-90">
            <div className="flex justify-between text-sm">
              <span>Active Contracts:</span>
              <span>{stats.active_contracts}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Expected This Month:</span>
              <span>${contractIncome.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wise Currency Balances */}
      {currencyBalances && currencyBalances.length > 0 && (
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg shadow-lg p-6 border border-teal-200">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={24} className="text-teal-700" />
            <h3 className="text-xl font-bold text-teal-900">Wise Account Balances</h3>
          </div>
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

      {/* Expenses Breakdown */}
      {stats.expenses_by_category && stats.expenses_by_category.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Expenses by Category</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.expenses_by_category.map((expense, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm font-medium text-gray-700">{expense.category}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  ${parseFloat(expense.total).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <IncomeVsExpenseChart months={12} />
        <CategoryBreakdownChart />
      </div>
    </div>
  );
}

export default DashboardView;
