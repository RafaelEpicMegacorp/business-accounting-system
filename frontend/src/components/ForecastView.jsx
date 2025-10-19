import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Users, Briefcase, Info } from 'lucide-react';
import entryService from '../services/entryService';
import currencyService from '../services/currencyService';

function ForecastView() {
  const [forecast, setForecast] = useState(null);
  const [totalUSD, setTotalUSD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecastData();
  }, []);

  const loadForecastData = async () => {
    try {
      setLoading(true);
      const [forecastData, totalUSDData] = await Promise.all([
        entryService.getForecast(),
        currencyService.getTotalBalanceInUSD()
      ]);
      setForecast(forecastData);
      setTotalUSD(totalUSDData);
    } catch (error) {
      console.error('Failed to load forecast data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading forecast data...</div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load forecast data</div>
      </div>
    );
  }

  const forecastBalance = parseFloat(forecast.forecasted_balance);
  const currentBalance = parseFloat(forecast.current_balance); // Now uses Wise balance from backend
  const accountingBalance = parseFloat(forecast.accounting_balance || 0);
  const balanceDifference = parseFloat(forecast.balance_difference || 0);
  const contractIncome = parseFloat(forecast.contract_income || 0);
  const weeklyPayments = parseFloat(forecast.weekly_payments);
  const monthlyPayments = parseFloat(forecast.monthly_payments);
  const totalExpenses = weeklyPayments + monthlyPayments;

  const isPositive = forecastBalance >= 0;
  const hasBalanceDifference = Math.abs(balanceDifference) > 0.01; // Show reconciliation if difference > 1 cent

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className={`${isPositive ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white rounded-lg shadow-lg p-8`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold opacity-90">End-of-Month Forecast</h1>
            <p className="text-white text-opacity-80 mt-1">
              {forecast.weeks_remaining} weeks remaining ({forecast.days_remaining} days)
            </p>
          </div>
          <Calendar size={48} className="opacity-80" />
        </div>
        <p className="text-5xl font-bold">
          ${Math.abs(forecastBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Calculation Breakdown */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign size={24} className="text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Calculation Breakdown</h2>
        </div>

        <div className="space-y-4">
          {/* Starting Balance */}
          <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Starting Balance</p>
                <p className="text-xs text-gray-500">Total Wise Balance (USD equivalent)</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-700">
              ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Contract Income */}
          <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                +
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Expected Contract Income</p>
                <p className="text-xs text-gray-500">
                  {forecast.contract_details?.length || 0} contract(s) with payments remaining this month
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              +${contractIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Weekly Payments */}
          <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                -
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Weekly Employee Payments</p>
                <p className="text-xs text-gray-500">
                  {forecast.weekly_details?.length || 0} employee(s) × {forecast.weeks_remaining} weeks
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold text-orange-700">
              -${weeklyPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Monthly Payments */}
          <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
                -
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Monthly Employee Payments</p>
                <p className="text-xs text-gray-500">
                  {forecast.monthly_details?.length || 0} employee(s) paid at month-end
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-700">
              -${monthlyPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-gray-300 my-4"></div>

          {/* Final Result */}
          <div className={`flex justify-between items-center p-4 ${isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} rounded-lg border-2`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${isPositive ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center text-white font-bold`}>
                =
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">End-of-Month Forecast</p>
                <p className="text-xs text-gray-500">Expected balance on {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString()}</p>
              </div>
            </div>
            <p className={`text-3xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
              ${Math.abs(forecastBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Balance Reconciliation Note (only show if there's a difference) */}
      {hasBalanceDifference && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <Info size={24} className="text-yellow-700 mt-1 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-yellow-900">Balance Reconciliation Note</h3>
              <p className="text-sm text-yellow-800">
                There is a <span className="font-semibold">${Math.abs(balanceDifference).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> difference between your Wise bank balance and accounting records:
              </p>
              <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-white rounded border border-yellow-200">
                <div>
                  <p className="text-xs text-gray-600">Wise Bank Balance</p>
                  <p className="text-lg font-bold text-gray-900">${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Accounting Balance (Entries)</p>
                  <p className="text-lg font-bold text-gray-900">${accountingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                This difference may be due to unsynced Wise transactions or manual entries not yet reconciled.
                The forecast uses your actual Wise bank balance for accuracy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contract Details */}
      {forecast.contract_details && forecast.contract_details.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={20} className="text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">Expected Contract Payments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Payment Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Payment Day</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {forecast.contract_details.map((contract, index) => (
                  <tr key={index} className="hover:bg-purple-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{contract.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(contract.payment_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Day {contract.payment_day}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-bold text-right">
                      ${parseFloat(contract.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-purple-100">
                <tr>
                  <td colSpan="3" className="px-4 py-3 text-sm font-bold text-gray-900">Total Expected Income</td>
                  <td className="px-4 py-3 text-sm font-bold text-purple-700 text-right">
                    ${contractIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Employee Payment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Employees */}
        {forecast.weekly_details && forecast.weekly_details.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} className="text-orange-600" />
              <h3 className="text-xl font-bold text-gray-900">Weekly Employees</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Employee</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Weeks</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {forecast.weekly_details.map((employee, index) => (
                    <tr key={index} className="hover:bg-orange-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{employee.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">{employee.weeks}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-bold text-right">
                        ${parseFloat(employee.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-orange-100">
                  <tr>
                    <td colSpan="2" className="px-4 py-3 text-sm font-bold text-gray-900">Total Weekly Payments</td>
                    <td className="px-4 py-3 text-sm font-bold text-orange-700 text-right">
                      ${weeklyPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Monthly Employees */}
        {forecast.monthly_details && forecast.monthly_details.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} className="text-red-600" />
              <h3 className="text-xl font-bold text-gray-900">Monthly Employees</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Employee</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {forecast.monthly_details.map((employee, index) => (
                    <tr key={index} className="hover:bg-red-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{employee.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-bold text-right">
                        ${parseFloat(employee.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-red-100">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">Total Monthly Payments</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-700 text-right">
                      ${monthlyPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Explanation Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
        <div className="flex items-start gap-3">
          <Info size={24} className="text-blue-600 mt-1 flex-shrink-0" />
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-gray-900">How is this calculated?</h3>
            <div className="space-y-2 text-gray-700">
              <p className="text-sm">
                The <span className="font-semibold">End-of-Month Forecast</span> predicts your account balance at the end of the current month based on:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>
                  <span className="font-semibold">Starting Balance</span> - Your actual Wise bank balance in USD (live balance from your Wise account)
                </li>
                <li>
                  <span className="font-semibold">Expected Contract Income</span> - All active monthly contracts with payment dates remaining in this month
                </li>
                <li>
                  <span className="font-semibold">Weekly Employee Payments</span> - Weekly salaries multiplied by the number of weeks remaining (currently {forecast.weeks_remaining} weeks)
                </li>
                <li>
                  <span className="font-semibold">Monthly Employee Payments</span> - Monthly salaries paid at the end of the month
                </li>
              </ul>
              <p className="text-sm mt-3">
                <span className="font-semibold">Formula:</span> Wise Balance + Contract Income - (Weekly Payments + Monthly Payments)
              </p>
              <p className="text-xs text-gray-600 mt-3 italic">
                <strong>Note:</strong> This forecast uses your actual Wise bank balance to ensure accuracy. It assumes all scheduled contract payments will be received and all employee payments will be made as scheduled. Actual results may vary.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForecastView;
