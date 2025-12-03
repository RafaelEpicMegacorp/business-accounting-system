import React, { useState, useEffect } from 'react';
import {
  Calendar, DollarSign, TrendingUp, TrendingDown, Users, Briefcase, Info,
  Calculator, RefreshCw, ChevronDown, ChevronUp, Settings, PieChart
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import forecastService from '../services/forecastService';
import entryService from '../services/entryService';
import currencyService from '../services/currencyService';

function ForecastView() {
  // State
  const [forecastMonths, setForecastMonths] = useState(3);
  const [projection, setProjection] = useState(null);
  const [currentMonthForecast, setCurrentMonthForecast] = useState(null);
  const [totalUSD, setTotalUSD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  const [showRecurringDetails, setShowRecurringDetails] = useState(false);

  useEffect(() => {
    loadForecastData();
  }, [forecastMonths]);

  const loadForecastData = async () => {
    try {
      setLoading(true);
      const [projectionData, currentForecast, totalUSDData] = await Promise.all([
        forecastService.getProjection(forecastMonths),
        entryService.getForecast(),
        currencyService.getTotalBalanceInUSD()
      ]);
      setProjection(projectionData);
      setCurrentMonthForecast(currentForecast);
      setTotalUSD(totalUSDData);
    } catch (error) {
      console.error('Failed to load forecast data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return parseFloat(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          Loading forecast data...
        </div>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load forecast data</div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = projection.projections.map((p, index) => ({
    name: p.month.split(' ')[0].substring(0, 3),
    balance: p.endingBalance,
    income: p.expectedIncome,
    expenses: p.totalExpenses,
    taxes: p.taxes.total
  }));

  const finalBalance = projection.projections.length > 0
    ? projection.projections[projection.projections.length - 1].endingBalance
    : projection.startingBalance;
  const isPositive = finalBalance >= 0;

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Forecast & Projections</h1>
              <p className="text-sm text-gray-500">Poland LLC (Sp. z o.o.) tax calculations included</p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2">
            {[1, 3, 6, 12].map(months => (
              <button
                key={months}
                onClick={() => setForecastMonths(months)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  forecastMonths === months
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {months} {months === 1 ? 'Month' : 'Months'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Starting Balance */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Starting Balance</h3>
            <DollarSign size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">${formatCurrency(projection.startingBalance)}</p>
          <p className="text-xs opacity-80 mt-1">Current Wise balance (USD)</p>
        </div>

        {/* Total Income */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Expected Income</h3>
            <TrendingUp size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">${formatCurrency(projection.summary.totalIncome)}</p>
          <p className="text-xs opacity-80 mt-1">From contracts ({forecastMonths}mo)</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Expected Expenses</h3>
            <TrendingDown size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">${formatCurrency(projection.summary.totalExpenses)}</p>
          <p className="text-xs opacity-80 mt-1">Salaries + recurring ({forecastMonths}mo)</p>
        </div>

        {/* Final Balance */}
        <div className={`bg-gradient-to-br ${isPositive ? 'from-teal-500 to-teal-600' : 'from-orange-500 to-orange-600'} text-white rounded-lg shadow-lg p-5`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Final Balance</h3>
            <Calculator size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">${formatCurrency(finalBalance)}</p>
          <p className="text-xs opacity-80 mt-1">After {forecastMonths} month{forecastMonths > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tax Summary Card */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg shadow-lg p-6 border border-orange-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="text-orange-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Poland LLC Tax Estimate</h2>
          </div>
          <button
            onClick={() => setShowTaxSettings(!showTaxSettings)}
            className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800"
          >
            <Settings size={16} />
            Settings
            {showTaxSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showTaxSettings && (
          <div className="mb-4 p-4 bg-white rounded-lg border border-orange-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">CIT Rate</label>
                <p className="text-lg font-bold text-orange-700">{projection.taxSettings.citRate}%</p>
                <p className="text-xs text-gray-500">
                  {projection.taxSettings.isSmallTaxpayer ? 'Small taxpayer rate' : 'Standard rate'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">ZUS Employer Rate</label>
                <p className="text-lg font-bold text-orange-700">{projection.taxSettings.zusRate}%</p>
                <p className="text-xs text-gray-500">Applied to all salaries</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Company Type</label>
                <p className="text-lg font-bold text-orange-700">Sp. z o.o.</p>
                <p className="text-xs text-gray-500">Polish LLC</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600">CIT (Corporate Tax)</p>
            <p className="text-xl font-bold text-orange-700">
              ${formatCurrency(projection.summary.totalTaxes * (projection.taxSettings.citRate / (projection.taxSettings.citRate + projection.taxSettings.zusRate)))}
            </p>
            <p className="text-xs text-gray-500">{projection.taxSettings.citRate}% on profit</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600">ZUS Employer</p>
            <p className="text-xl font-bold text-orange-700">
              ${formatCurrency(projection.summary.totalSalaries * (projection.taxSettings.zusRate / 100))}
            </p>
            <p className="text-xs text-gray-500">{projection.taxSettings.zusRate}% on salaries</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600">Total Tax Burden</p>
            <p className="text-xl font-bold text-red-600">${formatCurrency(projection.summary.totalTaxes)}</p>
            <p className="text-xs text-gray-500">Over {forecastMonths} month{forecastMonths > 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600">Net Position</p>
            <p className={`text-xl font-bold ${projection.summary.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {projection.summary.netPosition >= 0 ? '+' : ''}${formatCurrency(projection.summary.netPosition)}
            </p>
            <p className="text-xs text-gray-500">After all expenses & taxes</p>
          </div>
        </div>
      </div>

      {/* Projection Chart */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Balance Projection</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value) => [`$${formatCurrency(value)}`, '']}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#0891B2"
                fill="#0891B2"
                fillOpacity={0.3}
                name="Balance"
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#22C55E"
                fill="#22C55E"
                fillOpacity={0.2}
                name="Income"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.2}
                name="Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Month</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Start</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-green-700 uppercase">Income</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-700 uppercase">Expenses</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-orange-700 uppercase">Taxes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Net</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-blue-700 uppercase">End Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projection.projections.map((month, index) => (
                <tr key={index} className={`hover:bg-gray-50 ${!month.isPositive ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{month.month}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">${formatCurrency(month.startingBalance)}</td>
                  <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">+${formatCurrency(month.expectedIncome)}</td>
                  <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">-${formatCurrency(month.totalExpenses)}</td>
                  <td className="px-4 py-3 text-sm text-orange-600 text-right">-${formatCurrency(month.taxes.total)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${month.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {month.netChange >= 0 ? '+' : ''}${formatCurrency(month.netChange)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${month.isPositive ? 'text-blue-600' : 'text-red-600'}`}>
                    ${formatCurrency(month.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">${formatCurrency(projection.startingBalance)}</td>
                <td className="px-4 py-3 text-sm text-green-700 text-right font-bold">+${formatCurrency(projection.summary.totalIncome)}</td>
                <td className="px-4 py-3 text-sm text-red-700 text-right font-bold">-${formatCurrency(projection.summary.totalExpenses)}</td>
                <td className="px-4 py-3 text-sm text-orange-700 text-right font-bold">-${formatCurrency(projection.summary.totalTaxes)}</td>
                <td className={`px-4 py-3 text-sm text-right font-bold ${projection.summary.netPosition >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {projection.summary.netPosition >= 0 ? '+' : ''}${formatCurrency(projection.summary.netPosition)}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-bold ${isPositive ? 'text-blue-700' : 'text-red-700'}`}>
                  ${formatCurrency(finalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Recurring Expenses Section */}
      {projection.recurringExpensePatterns && projection.recurringExpensePatterns.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="text-purple-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Detected Recurring Expenses</h2>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                {projection.recurringExpensePatterns.length} patterns
              </span>
            </div>
            <button
              onClick={() => setShowRecurringDetails(!showRecurringDetails)}
              className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
            >
              {showRecurringDetails ? 'Hide' : 'Show'} Details
              {showRecurringDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm text-gray-600">Monthly Recurring</p>
              <p className="text-xl font-bold text-purple-700">
                ${formatCurrency(projection.summary.totalRecurring / forecastMonths)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm text-gray-600">Total ({forecastMonths}mo)</p>
              <p className="text-xl font-bold text-purple-700">${formatCurrency(projection.summary.totalRecurring)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm text-gray-600">Patterns Detected</p>
              <p className="text-xl font-bold text-purple-700">{projection.recurringExpensePatterns.length}</p>
            </div>
          </div>

          {showRecurringDetails && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Frequency</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projection.recurringExpensePatterns.map((pattern, index) => (
                    <tr key={index} className="hover:bg-purple-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{pattern.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{pattern.category}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          pattern.detected_frequency === 'monthly' ? 'bg-blue-100 text-blue-800' :
                          pattern.detected_frequency === 'weekly' ? 'bg-green-100 text-green-800' :
                          pattern.detected_frequency === 'quarterly' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {pattern.detected_frequency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        ${formatCurrency(pattern.typical_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                parseFloat(pattern.confidence_score) >= 0.9 ? 'bg-green-500' :
                                parseFloat(pattern.confidence_score) >= 0.8 ? 'bg-blue-500' :
                                'bg-orange-500'
                              }`}
                              style={{ width: `${parseFloat(pattern.confidence_score) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {(parseFloat(pattern.confidence_score) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Explanation Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
        <div className="flex items-start gap-3">
          <Info size={24} className="text-blue-600 mt-1 flex-shrink-0" />
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-gray-900">How are taxes calculated?</h3>
            <div className="space-y-2 text-gray-700">
              <p className="text-sm">
                This forecast uses <span className="font-semibold">Poland Sp. z o.o. (LLC)</span> tax regulations:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>
                  <span className="font-semibold">CIT (Corporate Income Tax)</span> - {projection.taxSettings.citRate}% on taxable profit (income minus expenses)
                  {projection.taxSettings.isSmallTaxpayer && ' - Small taxpayer rate (revenue < 2M EUR)'}
                </li>
                <li>
                  <span className="font-semibold">ZUS Employer Contributions</span> - {projection.taxSettings.zusRate}% on all employee salaries
                  <span className="text-xs text-gray-500 ml-1">(pension 9.76% + disability 6.50% + accident 1.67% + labor fund 2.45% + FGSP 0.10%)</span>
                </li>
                <li>
                  <span className="font-semibold">Recurring Expenses</span> - Auto-detected from your historical expense patterns
                </li>
              </ul>
              <p className="text-xs text-gray-600 mt-3 italic">
                <strong>Note:</strong> These are estimates for planning purposes. Actual tax obligations may vary based on specific circumstances, deductions, and current regulations. Consult with a tax professional for accurate calculations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForecastView;
