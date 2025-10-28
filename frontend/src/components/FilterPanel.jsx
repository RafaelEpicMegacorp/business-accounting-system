import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import employeeService from '../services/employeeService';

export default function FilterPanel({ filters, onFiltersChange, onClearAll }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Load employees for dropdown
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const data = await employeeService.getAll();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const categories = ['Employee', 'Administration', 'Software', 'Marketing', 'Equipment', 'Other'];
  const currencies = ['USD', 'EUR', 'PLN', 'GBP'];

  const handleCategoryChange = (category) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Count active filters (excluding search which is handled separately)
  const countActiveFilters = () => {
    let count = 0;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    if (filters.categories && filters.categories.length > 0) count++;
    if (filters.employeeId) count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.currency && filters.currency !== 'all') count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 mr-2"
            >
              <X className="h-4 w-4" />
              Clear all
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Filter Controls */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {/* Date Range */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Date Range</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  placeholder="Start Date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <input
                  type="date"
                  placeholder="End Date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Amount Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount || ''}
                  onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount || ''}
                  onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Employee Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Employee</label>
              <select
                value={filters.employeeId || ''}
                onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabled={loadingEmployees}
              >
                <option value="">All employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {!emp.is_active && '(Terminated)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Currency Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Currency</label>
              <select
                value={filters.currency || 'all'}
                onChange={(e) => handleFilterChange('currency', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All currencies</option>
                {currencies.map(curr => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Categories</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => {
                  const isSelected = filters.categories && filters.categories.includes(category);
                  return (
                    <button
                      key={category}
                      onClick={() => handleCategoryChange(category)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
