import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Ban, CheckCircle, Trash2, DollarSign, CheckSquare, Square, Info, X } from 'lucide-react';
import employeeService from '../services/employeeService';
import EmployeeTerminationModal from './EmployeeTerminationModal';

export default function EmployeeList({ onEmployeeSelect, onEdit }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active', 'terminated', 'all'
  const [terminatingEmployee, setTerminatingEmployee] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [infoModal, setInfoModal] = useState({
    isOpen: false,
    title: '',
    explanation: '',
    example: '',
    formula: ''
  });

  useEffect(() => {
    loadEmployees();
  }, [filter]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const isActive = filter === 'active' ? true : filter === 'terminated' ? false : null;
      const data = await employeeService.getAll(isActive);
      setEmployees(data);
      setSelectedEmployees([]); // Clear selections on reload
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTerminate = (employee) => {
    setTerminatingEmployee(employee);
  };

  const handleTerminationClose = () => {
    setTerminatingEmployee(null);
  };

  const handleTerminationSuccess = () => {
    loadEmployees();
  };

  const handleReactivate = async (id, name) => {
    if (window.confirm(`Reactivate ${name}?`)) {
      try {
        await employeeService.reactivate(id);
        loadEmployees();
      } catch (error) {
        alert('Failed to reactivate employee');
        console.error(error);
      }
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Permanently delete ${name}? This can only be done if they have no payment entries.`)) {
      try {
        await employeeService.delete(id);
        loadEmployees();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to delete employee');
        console.error(error);
      }
    }
  };

  // Bulk selection handlers
  const toggleEmployeeSelection = (id) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(empId => empId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(e => e.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedEmployees.length} employees? This can only be done if they have no payment entries.`)) {
      return;
    }

    try {
      const result = await employeeService.bulkDelete(selectedEmployees);
      if (result.failed.length > 0) {
        alert(`Deleted ${result.affected} employees. Failed to delete ${result.failed.length} employees:\n${result.failed.map(f => `ID ${f.id}: ${f.reason}`).join('\n')}`);
      } else {
        alert(`Successfully deleted ${result.affected} employees.`);
      }
      loadEmployees();
    } catch (error) {
      alert('Failed to delete employees. Please try again.');
      console.error('Bulk delete error:', error);
    }
  };

  const handleBulkTerminate = async () => {
    const terminationDate = prompt('Enter termination date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!terminationDate) return;

    try {
      const result = await employeeService.bulkTerminate(selectedEmployees, terminationDate);
      if (result.failed.length > 0) {
        alert(`Terminated ${result.affected} employees. Failed to terminate ${result.failed.length} employees:\n${result.failed.map(f => `ID ${f.id}: ${f.reason}`).join('\n')}`);
      } else {
        alert(`Successfully terminated ${result.affected} employees.`);
      }
      loadEmployees();
    } catch (error) {
      alert('Failed to terminate employees. Please try again.');
      console.error('Bulk terminate error:', error);
    }
  };

  const handleBulkReactivate = async () => {
    if (!window.confirm(`Are you sure you want to reactivate ${selectedEmployees.length} employees?`)) {
      return;
    }

    try {
      const result = await employeeService.bulkReactivate(selectedEmployees);
      if (result.failed.length > 0) {
        alert(`Reactivated ${result.affected} employees. Failed to reactivate ${result.failed.length} employees:\n${result.failed.map(f => `ID ${f.id}: ${f.reason}`).join('\n')}`);
      } else {
        alert(`Successfully reactivated ${result.affected} employees.`);
      }
      loadEmployees();
    } catch (error) {
      alert('Failed to reactivate employees. Please try again.');
      console.error('Bulk reactivate error:', error);
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

  const calculateTenure = (startDate) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    if (years > 0) {
      return months > 0 ? `${years}y ${months}m` : `${years}y`;
    } else if (months > 0) {
      return `${months}m`;
    } else {
      return `${diffDays}d`;
    }
  };

  // Calculate payroll totals
  const activeEmployees = employees.filter(e => e.is_active);
  const monthlyPayroll = activeEmployees
    .filter(e => e.pay_type === 'monthly')
    .reduce((sum, e) => sum + (parseFloat(e.pay_rate) * parseFloat(e.pay_multiplier)), 0);
  const weeklyPayroll = activeEmployees
    .filter(e => e.pay_type === 'weekly')
    .reduce((sum, e) => sum + (parseFloat(e.pay_rate) * parseFloat(e.pay_multiplier)), 0);
  const totalPayroll = monthlyPayroll + weeklyPayroll;
  const totalPaid = employees.reduce((sum, e) => sum + parseFloat(e.total_paid || 0), 0);

  // Helper function to open info modal
  const openInfoModal = (title, explanation, example, formula) => {
    setInfoModal({
      isOpen: true,
      title,
      explanation,
      example,
      formula
    });
  };

  // Helper function to close info modal
  const closeInfoModal = () => {
    setInfoModal({
      isOpen: false,
      title: '',
      explanation: '',
      example: '',
      formula: ''
    });
  };

  // InfoModal Component
  const InfoModal = () => {
    if (!infoModal.isOpen) return null;

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={closeInfoModal}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">{infoModal.title}</h3>
            <button
              onClick={closeInfoModal}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">What this means:</h4>
              <p className="text-gray-600">{infoModal.explanation}</p>
            </div>

            {infoModal.example && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Example calculation:</h4>
                <p className="text-gray-600 whitespace-pre-line">{infoModal.example}</p>
              </div>
            )}

            {infoModal.formula && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Formula:</h4>
                <p className="text-sm font-mono bg-gray-100 p-3 rounded text-gray-800">
                  {infoModal.formula}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={closeInfoModal}
            className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading employees...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Info Modal */}
      <InfoModal />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="text-gray-700" size={24} />
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
            {employees.length}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Employee
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active ({employees.filter(e => e.is_active).length})
        </button>
        <button
          onClick={() => setFilter('terminated')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'terminated'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Terminated ({employees.filter(e => !e.is_active).length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
      </div>

      {/* Payroll Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* Total Payroll - NEW */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Total Payroll</h3>
            <button
              onClick={() => openInfoModal(
                'Combined Payroll Total',
                'Sum of all payroll costs across monthly and weekly employees. This represents your total recurring salary expense.',
                `Monthly Payroll: $${formatCurrency(monthlyPayroll)}\n+ Weekly Payroll: $${formatCurrency(weeklyPayroll)}\n= Total: $${formatCurrency(totalPayroll)}`,
                'Monthly Payroll + Weekly Payroll'
              )}
              className="hover:opacity-80 transition-opacity"
            >
              <Info size={18} className="opacity-80" />
            </button>
          </div>
          <p className="text-2xl font-bold">
            ${formatCurrency(totalPayroll)}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {activeEmployees.length} active employees
          </p>
        </div>

        {/* Monthly Payroll */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Monthly Payroll</h3>
            <button
              onClick={() => {
                const monthlyEmps = activeEmployees.filter(e => e.pay_type === 'monthly');
                const examples = monthlyEmps.slice(0, 3).map(e =>
                  `${e.name}: $${formatCurrency(parseFloat(e.pay_rate))} × ${(parseFloat(e.pay_multiplier) * 100).toFixed(0)}% = $${formatCurrency(parseFloat(e.pay_rate) * parseFloat(e.pay_multiplier))}`
                ).join('\n');
                openInfoModal(
                  'Monthly Payroll Calculation',
                  'Total monthly salary cost for all active monthly employees including tax multiplier (typically 112% to account for employer taxes and benefits).',
                  examples + (monthlyEmps.length > 3 ? `\n... and ${monthlyEmps.length - 3} more` : ''),
                  'Sum of (Pay Rate × Pay Multiplier) for monthly employees'
                );
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <Info size={18} className="opacity-80" />
            </button>
          </div>
          <p className="text-2xl font-bold">
            ${formatCurrency(monthlyPayroll)}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {activeEmployees.filter(e => e.pay_type === 'monthly').length} employees
          </p>
        </div>

        {/* Weekly Payroll */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Weekly Payroll</h3>
            <button
              onClick={() => {
                const weeklyEmps = activeEmployees.filter(e => e.pay_type === 'weekly');
                const examples = weeklyEmps.map(e =>
                  `${e.name}: $${formatCurrency(parseFloat(e.pay_rate))} × ${(parseFloat(e.pay_multiplier) * 100).toFixed(0)}% = $${formatCurrency(parseFloat(e.pay_rate) * parseFloat(e.pay_multiplier))}`
                ).join('\n');
                openInfoModal(
                  'Weekly Payroll Calculation',
                  'Total weekly salary cost for all active weekly employees including tax multiplier (typically 112% to account for employer taxes and benefits).',
                  examples || 'No weekly employees',
                  'Sum of (Pay Rate × Pay Multiplier) for weekly employees'
                );
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <Info size={18} className="opacity-80" />
            </button>
          </div>
          <p className="text-2xl font-bold">
            ${formatCurrency(weeklyPayroll)}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {activeEmployees.filter(e => e.pay_type === 'weekly').length} employees
          </p>
        </div>

        {/* Total Paid */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Total Paid</h3>
            <button
              onClick={() => {
                const paidEmps = employees.filter(e => parseFloat(e.total_paid || 0) > 0);
                const examples = paidEmps.slice(0, 5).map(e =>
                  `${e.name}: $${formatCurrency(parseFloat(e.total_paid || 0))}`
                ).join('\n');
                openInfoModal(
                  'Historical Payments Made',
                  'Actual money paid to employees from completed transactions in the database. This is NOT calculated from pay rates - it comes from actual payment entries that have been recorded.',
                  examples + (paidEmps.length > 5 ? `\n... and ${paidEmps.length - 5} more` : ''),
                  'Sum of total_paid column (actual payments, not rate-based)'
                );
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <Info size={18} className="opacity-80" />
            </button>
          </div>
          <p className="text-2xl font-bold">
            ${formatCurrency(totalPaid)}
          </p>
          <p className="text-xs opacity-80 mt-1">Historical payments</p>
        </div>

        {/* Active Employees */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Active Team</h3>
            <button
              onClick={() => {
                const terminatedEmps = employees.filter(e => !e.is_active);
                openInfoModal(
                  'Active Employees Count',
                  'Number of employees currently working (not terminated). An employee is considered active if they have no termination date or if is_active is true.',
                  `Active: ${activeEmployees.length} employees\nTerminated: ${terminatedEmps.length} employees\nTotal: ${employees.length} employees`,
                  'Count of employees where is_active = true'
                );
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <Info size={18} className="opacity-80" />
            </button>
          </div>
          <p className="text-2xl font-bold">
            {activeEmployees.length}
          </p>
          <p className="text-xs opacity-80 mt-1">
            of {employees.length} total
          </p>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedEmployees.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="text-blue-700 font-medium">{selectedEmployees.length} employees selected</span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkTerminate}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
            >
              Terminate Selected
            </button>
            <button
              onClick={handleBulkReactivate}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
            >
              Reactivate Selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 text-sm"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedEmployees([])}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                <button onClick={toggleSelectAll} className="hover:text-gray-900">
                  {selectedEmployees.length === employees.length && employees.length > 0 ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Position</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Project</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Pay Type</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Tenure</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Pay Rate</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Multiplier</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Total Paid</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Start Date</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleEmployeeSelection(employee.id)} className="hover:text-blue-600">
                    {selectedEmployees.includes(employee.id) ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{employee.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {employee.position || <span className="text-gray-400 italic">Not set</span>}
                </td>
                <td className="px-4 py-3">
                  {employee.primary_project_name ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: employee.primary_project_color || '#3B82F6' }}
                      />
                      <span className="text-sm text-gray-700">{employee.primary_project_name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-sm">No project</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {getPayTypeLabel(employee.pay_type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                    {calculateTenure(employee.start_date)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">${formatCurrency(employee.pay_rate)}</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {(parseFloat(employee.pay_multiplier) * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  ${formatCurrency(employee.total_paid)}
                </td>
                <td className="px-4 py-3 text-gray-700">{formatDate(employee.start_date)}</td>
                <td className="px-4 py-3 text-center">
                  {employee.is_active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                      Terminated
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(employee)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    {employee.is_active ? (
                      <button
                        onClick={() => handleTerminate(employee)}
                        className="text-red-600 hover:text-red-800"
                        title="Terminate"
                      >
                        <Ban size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(employee.id, employee.name)}
                        className="text-green-600 hover:text-green-800"
                        title="Reactivate"
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(employee.id, employee.name)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {employees.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No employees found. Click "Add Employee" to get started.
          </div>
        )}
      </div>

      {/* Termination Modal */}
      {terminatingEmployee && (
        <EmployeeTerminationModal
          employee={terminatingEmployee}
          onClose={handleTerminationClose}
          onSuccess={handleTerminationSuccess}
        />
      )}
    </div>
  );
}
