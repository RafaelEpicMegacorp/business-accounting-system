import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Ban, CheckCircle, Trash2, DollarSign, CheckSquare, Square } from 'lucide-react';
import employeeService from '../services/employeeService';
import EmployeeTerminationModal from './EmployeeTerminationModal';

export default function EmployeeList({ onEmployeeSelect, onEdit }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active', 'terminated', 'all'
  const [terminatingEmployee, setTerminatingEmployee] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);

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

  if (loading) {
    return <div className="text-center py-8">Loading employees...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Pay Type</th>
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
                <td className="px-4 py-3 text-gray-700">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {getPayTypeLabel(employee.pay_type)}
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
