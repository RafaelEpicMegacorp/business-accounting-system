import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Mail, User, TrendingUp, Briefcase, MapPin, Linkedin, FileText, CheckCircle, MessageSquare } from 'lucide-react';
import employeeService from '../services/employeeService';

export default function EmployeeForm({ employee, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    payType: 'monthly',
    payRate: '',
    payMultiplier: '1.12',
    startDate: new Date().toISOString().split('T')[0],
    role: '',
    birthday: '',
    location: '',
    linkedinUrl: '',
    cvUrl: '',
    contractSigned: false,
    ndaSigned: false,
    fullTime: true,
    comments: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        payType: employee.pay_type || 'monthly',
        payRate: employee.pay_rate || '',
        payMultiplier: employee.pay_multiplier || '1.12',
        startDate: employee.start_date ? new Date(employee.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        role: employee.role || '',
        birthday: employee.birthday ? new Date(employee.birthday).toISOString().split('T')[0] : '',
        location: employee.location || '',
        linkedinUrl: employee.linkedin_url || '',
        cvUrl: employee.cv_url || '',
        contractSigned: employee.contract_signed || false,
        ndaSigned: employee.nda_signed || false,
        fullTime: employee.full_time !== undefined ? employee.full_time : true,
        comments: employee.comments || ''
      });
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

      if (employee) {
        await employeeService.update(employee.id, formData);
      } else {
        await employeeService.create(formData);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save employee');
      console.error(err);
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
            {employee ? 'Edit Employee' : 'Add New Employee'}
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
                {employee
                  ? '⚠️ Editing start date will affect severance calculations'
                  : 'When did this employee start working?'}
              </p>
            </div>

            {/* Section Divider */}
            <div className="border-t border-gray-300 pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            </div>

            {/* Role */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Briefcase size={16} />
                Role / Position
              </label>
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Senior Developer, Marketing Manager"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Birthday */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Calendar size={16} />
                  Birthday
                </label>
                <input
                  type="date"
                  name="birthday"
                  value={formData.birthday}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <MapPin size={16} />
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="City, Country"
                />
              </div>
            </div>

            {/* LinkedIn URL */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Linkedin size={16} />
                LinkedIn Profile
              </label>
              <input
                type="url"
                name="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            {/* CV URL */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <FileText size={16} />
                CV / Resume URL
              </label>
              <input
                type="url"
                name="cvUrl"
                value={formData.cvUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Link to CV or resume file"
              />
            </div>

            {/* Checkboxes Section */}
            <div className="border-t border-gray-300 pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status & Documents</h3>
            </div>

            <div className="space-y-3">
              {/* Contract Signed */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="contractSigned"
                  name="contractSigned"
                  checked={formData.contractSigned}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="contractSigned" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <CheckCircle size={16} />
                  Contract Signed
                </label>
              </div>

              {/* NDA Signed */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ndaSigned"
                  name="ndaSigned"
                  checked={formData.ndaSigned}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ndaSigned" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <CheckCircle size={16} />
                  NDA Signed
                </label>
              </div>

              {/* Full Time */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="fullTime"
                  name="fullTime"
                  checked={formData.fullTime}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="fullTime" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <CheckCircle size={16} />
                  Full-Time Employee
                </label>
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <MessageSquare size={16} />
                Comments / Notes
              </label>
              <textarea
                name="comments"
                value={formData.comments}
                onChange={handleChange}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional notes about this employee..."
              />
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
              {loading ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
