import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Mail, User, TrendingUp } from 'lucide-react';
import employeeService from '../services/employeeService';

export default function EmployeeForm({ employee, onClose, onSuccess }) {
  const [employeeId, setEmployeeId] = useState(null); // Store employee ID separately
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    payType: 'monthly',
    payRate: '',
    payMultiplier: '1.12',
    startDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('EmployeeForm received employee:', employee);
    if (employee) {
      console.log('Employee ID:', employee.id);
      console.log('Employee keys:', Object.keys(employee));

      // Store the employee ID in local state to prevent losing it
      setEmployeeId(employee.id);

      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        payType: employee.pay_type || 'monthly',
        payRate: employee.pay_rate || '',
        payMultiplier: employee.pay_multiplier || '1.12',
        startDate: employee.start_date ? new Date(employee.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      // Reset employeeId if no employee (creating new)
      setEmployeeId(null);
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateTotal = () => {
    const rate = parseFloat(formData.payRate) || 0;
    const multiplier = parseFloat(formData.payMultiplier) || 1.0;
    return (rate * multiplier).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.payRate || !formData.payMultiplier) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (employeeId) {
        // Updating existing employee using stored employeeId
        console.log('Updating employee with ID:', employeeId);
        await employeeService.update(employeeId, formData);
      } else {
        // Creating new employee
        console.log('Creating new employee');
        await employeeService.create(formData);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save employee');
      console.error('Employee form error:', err);
      console.error('Employee ID used:', employeeId);
      console.error('Form data:', formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {employeeId ? 'Edit Employee' : 'Add New Employee'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <User size={16} />
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Employee name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="employee@example.com"
              />
            </div>

            {/* Pay Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <TrendingUp size={16} />
                Pay Type *
              </label>
              <select
                name="payType"
                value={formData.payType}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="hourly">Hourly</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.payType === 'monthly' && 'Fixed monthly salary'}
                {formData.payType === 'weekly' && 'Paid per week'}
                {formData.payType === 'hourly' && 'Paid per hour worked'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Pay Rate */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <DollarSign size={16} />
                  Base Pay Rate *
                </label>
                <input
                  type="number"
                  name="payRate"
                  value={formData.payRate}
                  onChange={handleChange}
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Multiplier */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Multiplier (Taxes/Benefits) *
                </label>
                <input
                  type="number"
                  name="payMultiplier"
                  value={formData.payMultiplier}
                  onChange={handleChange}
                  required
                  step="0.0001"
                  min="0.0001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1.12"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {((parseFloat(formData.payMultiplier) - 1) * 100).toFixed(2)}% overhead
                </p>
              </div>
            </div>

            {/* Total Calculation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">Total Payment Amount:</span>
                <span className="text-2xl font-bold text-blue-900">${calculateTotal()}</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Base Rate ${formData.payRate || '0.00'} × {formData.payMultiplier || '1.00'}
              </p>
            </div>

            {/* Start Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Calendar size={16} />
                Start Date *
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {employeeId
                  ? '⚠️ Editing start date will affect severance calculations'
                  : 'When did this employee start working?'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : employeeId ? 'Update Employee' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
