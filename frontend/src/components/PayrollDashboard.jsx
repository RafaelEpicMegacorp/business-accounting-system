import React, { useState, useEffect } from 'react';
import { DollarSign, Users, Briefcase, ChevronDown, ChevronUp, History } from 'lucide-react';
import payrollService from '../services/payrollService';

export default function PayrollDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [showTerminated, setShowTerminated] = useState(false);

  useEffect(() => {
    loadPayrollData();
  }, []);

  const loadPayrollData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await payrollService.getSummary();
      setData(result);
    } catch (err) {
      console.error('Failed to load payroll data:', err);
      setError('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const toggleProjectExpand = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-lg">
        {error}
        <button
          onClick={loadPayrollData}
          className="ml-4 text-sm underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const { totals, projects, employees, terminated } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payroll Dashboard</h1>
        <button
          onClick={loadPayrollData}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Monthly Payroll</p>
              <p className="text-3xl font-bold mt-1">
                {formatCurrency(totals?.total_monthly_payroll)}
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Active Employees</p>
              <p className="text-3xl font-bold mt-1">{totals?.active_employees || 0}</p>
            </div>
            <Users className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Projects with Staff</p>
              <p className="text-3xl font-bold mt-1">{totals?.projects_with_employees || 0}</p>
            </div>
            <Briefcase className="h-12 w-12 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">Terminated (History)</p>
              <p className="text-3xl font-bold mt-1">{totals?.terminated_employees || 0}</p>
            </div>
            <History className="h-12 w-12 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Pay Type Breakdown */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost by Pay Type</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Monthly Employees</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totals?.monthly_employees_cost)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Weekly Employees</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totals?.weekly_employees_cost)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Hourly Employees (est.)</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totals?.hourly_employees_cost)}</p>
          </div>
        </div>
      </div>

      {/* Per-Project Breakdown */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Cost by Project</h2>
        </div>
        <div className="divide-y">
          {projects?.filter(p => parseFloat(p.employee_count) > 0).map(project => (
            <div key={project.id} className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleProjectExpand(project.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: project.color || '#3B82F6' }}
                  />
                  <div>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-500">{project.employee_count} employee(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(project.monthly_cost)}
                  </span>
                  {expandedProjects[project.id] ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded employee list for this project */}
              {expandedProjects[project.id] && (
                <div className="mt-4 pl-7 space-y-2">
                  {employees
                    ?.filter(emp => emp.projects?.some(p => p.id === project.id))
                    .map(emp => {
                      const projectAssignment = emp.projects.find(p => p.id === project.id);
                      const allocation = projectAssignment?.allocation || 100;
                      const costForProject = (parseFloat(emp.monthly_cost) * allocation) / 100;

                      return (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{emp.name}</span>
                            {emp.position && (
                              <span className="text-sm text-gray-500 ml-2">({emp.position})</span>
                            )}
                            {allocation < 100 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2">
                                {allocation}% allocation
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-gray-700">
                            {formatCurrency(costForProject)}/mo
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ))}

          {projects?.filter(p => parseFloat(p.employee_count) > 0).length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No projects with assigned employees
            </div>
          )}
        </div>
      </div>

      {/* Per-Employee Breakdown */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">All Active Employees</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Projects</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pay Type</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Multiplier</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Monthly Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees?.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{emp.name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {emp.position || <span className="text-gray-400 italic">Not set</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {emp.projects?.length > 0 ? (
                        emp.projects.map(p => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${p.color}20`,
                              color: p.color
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}
                            {p.isPrimary && <span className="text-xs">*</span>}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-xs">Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 capitalize">
                      {emp.pay_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(emp.pay_rate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {parseFloat(emp.pay_multiplier).toFixed(2)}x
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-gray-900">
                      {formatCurrency(emp.monthly_cost)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!employees || employees.length === 0) && (
            <div className="p-8 text-center text-gray-500">
              No active employees
            </div>
          )}
        </div>
      </div>

      {/* Terminated Employees History */}
      {terminated && terminated.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div
            className="p-4 border-b cursor-pointer flex items-center justify-between"
            onClick={() => setShowTerminated(!showTerminated)}
          >
            <h2 className="text-lg font-semibold text-gray-500">
              Terminated Employees ({terminated.length})
            </h2>
            {showTerminated ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>

          {showTerminated && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Position</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Projects</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Terminated</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Monthly Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {terminated.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50 bg-gray-25">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-600">{emp.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {emp.position || <span className="italic">Not set</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {emp.last_projects?.length > 0 ? (
                            emp.last_projects.map(p => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: p.color || '#999' }}
                                />
                                {p.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic text-xs">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(emp.termination_date)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {formatCurrency(emp.last_monthly_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
