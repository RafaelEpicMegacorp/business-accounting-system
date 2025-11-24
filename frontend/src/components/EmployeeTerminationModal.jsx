import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import employeeService from '../services/employeeService';

export default function EmployeeTerminationModal({ employee, onClose, onSuccess }) {
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [createEntry, setCreateEntry] = useState(true);
  const [severance, setSeverance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(null);

  // Editable employee fields
  const [payType, setPayType] = useState(employee.pay_type);
  const [payRate, setPayRate] = useState(employee.pay_rate);
  const [startDate, setStartDate] = useState(employee.start_date.split('T')[0]);
  const [payMultiplier, setPayMultiplier] = useState(employee.pay_multiplier);

  // Calculate severance when any field changes
  useEffect(() => {
    calculateSeverance();
  }, [terminationDate, payType, payRate, startDate, payMultiplier]);

  const calculateSeverance = async () => {
    try {
      setCalculating(true);
      setError(null);
      const data = await employeeService.calculateSeverancePreview(
        employee.id,
        terminationDate,
        {
          payType,
          payRate: parseFloat(payRate),
          startDate,
          payMultiplier: parseFloat(payMultiplier)
        }
      );
      setSeverance(data);
    } catch (err) {
      setError('Failed to calculate severance');
      console.error(err);
    } finally {
      setCalculating(false);
    }
  };

  const handleTerminate = async () => {
    if (!window.confirm(`Confirm termination of ${employee.name}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if employee fields were modified
      const fieldsChanged =
        payType !== employee.pay_type ||
        parseFloat(payRate) !== parseFloat(employee.pay_rate) ||
        startDate !== employee.start_date.split('T')[0] ||
        parseFloat(payMultiplier) !== parseFloat(employee.pay_multiplier);

      // Update employee if fields changed
      if (fieldsChanged) {
        await employeeService.update(employee.id, {
          name: employee.name,
          email: employee.email,
          payType,
          payRate: parseFloat(payRate),
          startDate,
          payMultiplier: parseFloat(payMultiplier)
        });
      }

      // Terminate employee
      await employeeService.terminate(employee.id, terminationDate, createEntry);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to terminate employee');
      console.error(err);
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPayTypeLabel = (payType) => {
    const labels = {
      monthly: 'Monthly',
      weekly: 'Weekly',
      hourly: 'Hourly'
    };
    return labels[payType] || payType;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Terminate Employee</h2>
            <p className="text-gray-600 mt-1">{employee.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Employee Info - Editable */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Employee Details (editable)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pay Type</label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Base Rate ($)</label>
                <input
                  type="number"
                  value={payRate}
                  onChange={(e) => setPayRate(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Multiplier (%)</label>
                <input
                  type="number"
                  value={parseFloat(payMultiplier) * 100}
                  onChange={(e) => setPayMultiplier(parseFloat(e.target.value) / 100)}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Termination Date */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} />
              Termination Date
            </label>
            <input
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be between start date and today
            </p>
          </div>

          {/* Severance Calculation */}
          {calculating && (
            <div className="text-center py-8 text-gray-500">
              Calculating severance...
            </div>
          )}

          {!calculating && severance && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                <DollarSign size={20} />
                Severance Calculation
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Period Worked:</span>
                  <span className="font-medium text-blue-900">{severance.period_description}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Days Worked:</span>
                  <span className="font-medium text-blue-900">{severance.days_worked} days</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Base Rate:</span>
                  <span className="font-medium text-blue-900">${formatCurrency(severance.pay_rate)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Multiplier:</span>
                  <span className="font-medium text-blue-900">{(severance.pay_multiplier * 100).toFixed(2)}%</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Payment Due:</span>
                  <span className="font-medium text-blue-900">{formatDate(severance.payment_due_date)}</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  {employee.pay_type === 'monthly'
                    ? '💼 Payment at end of month'
                    : employee.pay_type === 'weekly'
                    ? '📅 Payment at end of week (Sunday)'
                    : '⏱️ Payment on termination date'}
                </p>

                <div className="border-t-2 border-blue-300 my-3"></div>

                <div className="flex justify-between">
                  <span className="text-lg font-bold text-blue-900">Total Severance:</span>
                  <span className="text-2xl font-bold text-blue-900">${formatCurrency(severance.total_severance)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Create Entry Option */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createEntry}
                onChange={(e) => setCreateEntry(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Auto-create payment entry</div>
                <div className="text-sm text-gray-600 mt-1">
                  Creates a pending expense entry for the severance payment in the entries list
                </div>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTerminate}
              disabled={loading || calculating || !severance}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Terminating...' : 'Terminate Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
