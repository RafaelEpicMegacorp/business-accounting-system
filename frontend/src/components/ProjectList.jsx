import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Edit2, Archive, Trash2, Users, X } from 'lucide-react';
import projectService from '../services/projectService';

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    color: '#3B82F6',
    clientName: '',
    startDate: '',
    endDate: '',
    budget: ''
  });

  // Modal state for project details
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [filter]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getAll(filter);
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      alert('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'active',
      color: project.color || '#3B82F6',
      clientName: project.client_name || '',
      startDate: project.start_date || '',
      endDate: project.end_date || '',
      budget: project.budget || ''
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      description: '',
      status: 'active',
      color: '#3B82F6',
      clientName: '',
      startDate: '',
      endDate: '',
      budget: ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await projectService.update(editingProject.id, formData);
      } else {
        await projectService.create(formData);
      }
      setShowForm(false);
      loadProjects();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save project');
    }
  };

  const handleArchive = async (id, name) => {
    if (window.confirm(`Archive project "${name}"?`)) {
      try {
        await projectService.archive(id);
        loadProjects();
      } catch (error) {
        alert('Failed to archive project');
      }
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Permanently delete "${name}"? This will remove all employee assignments.`)) {
      try {
        await projectService.delete(id);
        loadProjects();
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to delete project');
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      on_hold: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      archived: 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  // Helper functions for cost calculations
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateEmployeeMonthlyCost = (employee) => {
    const { pay_type, pay_rate, pay_multiplier, allocation_percentage } = employee;
    const allocation = (allocation_percentage || 100) / 100;
    const multiplier = pay_multiplier || 1;

    let baseMonthlyCost = 0;
    switch(pay_type) {
      case 'monthly':
        baseMonthlyCost = pay_rate;
        break;
      case 'weekly':
        baseMonthlyCost = pay_rate * 4;  // 4 weeks per month
        break;
      case 'hourly':
        baseMonthlyCost = pay_rate * 160;  // 160 hours per month
        break;
      default:
        baseMonthlyCost = 0;
    }

    return baseMonthlyCost * multiplier * allocation;
  };

  const calculateTotalMonthlyCost = (employees) => {
    if (!employees || employees.length === 0) return 0;
    return employees
      .filter(emp => emp.removedDate === null)  // Only active assignments
      .reduce((sum, emp) => sum + calculateEmployeeMonthlyCost(emp), 0);
  };

  // Handle project card click to show details
  const handleProjectClick = async (projectId, e) => {
    // Don't trigger if clicking on action buttons
    if (e.target.closest('button')) {
      return;
    }

    try {
      setLoadingDetails(true);
      setShowDetailModal(true);
      const details = await projectService.getWithEmployees(projectId);
      setProjectDetails(details);
    } catch (error) {
      console.error('Failed to load project details:', error);
      alert('Failed to load project details');
      setShowDetailModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Project Detail Modal Component
  const ProjectDetailModal = () => {
    if (!showDetailModal) return null;

    const activeEmployees = projectDetails?.employees?.filter(emp => emp.removedDate === null) || [];
    const removedEmployees = projectDetails?.employees?.filter(emp => emp.removedDate !== null) || [];
    const totalCost = calculateTotalMonthlyCost(projectDetails?.employees || []);
    const budgetRemaining = projectDetails?.budget ? parseFloat(projectDetails.budget) - totalCost : null;
    const budgetUsedPercent = projectDetails?.budget ? (totalCost / parseFloat(projectDetails.budget)) * 100 : null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: projectDetails?.color || '#3B82F6' }}
              />
              <h2 className="text-2xl font-bold text-gray-900">
                {loadingDetails ? 'Loading...' : projectDetails?.name}
              </h2>
              {projectDetails && getStatusBadge(projectDetails.status)}
            </div>
            <button
              onClick={() => setShowDetailModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loadingDetails ? (
              <div className="text-center py-12 text-gray-500">Loading project details...</div>
            ) : projectDetails ? (
              <>
                {/* Description */}
                {projectDetails.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">DESCRIPTION</h3>
                    <p className="text-gray-600">{projectDetails.description}</p>
                  </div>
                )}

                {/* Project Info */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                  {projectDetails.client_name && (
                    <div>
                      <p className="text-xs text-gray-500">Client</p>
                      <p className="text-sm font-medium text-gray-900">{projectDetails.client_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Start Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(projectDetails.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">End Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(projectDetails.end_date)}</p>
                  </div>
                  {projectDetails.budget && (
                    <div>
                      <p className="text-xs text-gray-500">Budget</p>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(parseFloat(projectDetails.budget))}</p>
                    </div>
                  )}
                </div>

                {/* Team Members */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    TEAM MEMBERS ({activeEmployees.length} active)
                  </h3>

                  {activeEmployees.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No active employees assigned to this project</p>
                  ) : (
                    <div className="space-y-3">
                      {activeEmployees.map(employee => {
                        const monthlyCost = calculateEmployeeMonthlyCost(employee);
                        const allocation = employee.allocation_percentage || 100;

                        return (
                          <div
                            key={employee.id}
                            className={`border rounded-lg p-4 ${
                              employee.is_primary ? 'border-blue-400 bg-blue-50' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">{employee.name}</h4>
                                {employee.is_primary && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <span className="text-lg font-bold text-gray-900">
                                {formatCurrency(monthlyCost)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {employee.position && (
                                <div>
                                  <span className="text-gray-500">Position:</span>
                                  <span className="ml-1 text-gray-900">{employee.position}</span>
                                </div>
                              )}
                              {employee.role && (
                                <div>
                                  <span className="text-gray-500">Role:</span>
                                  <span className="ml-1 text-gray-900">{employee.role}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500">Pay Rate:</span>
                                <span className="ml-1 text-gray-900">
                                  {formatCurrency(employee.pay_rate)}/{employee.pay_type}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Allocation:</span>
                                <span className="ml-1 text-gray-900">{allocation}%</span>
                              </div>
                              {employee.pay_multiplier && employee.pay_multiplier !== 1 && (
                                <div>
                                  <span className="text-gray-500">Multiplier:</span>
                                  <span className="ml-1 text-gray-900">{employee.pay_multiplier}x</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500">Assigned:</span>
                                <span className="ml-1 text-gray-900">{formatDate(employee.assigned_date)}</span>
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t">
                              <span className="text-xs text-gray-600">
                                Monthly Cost for this Project: <span className="font-semibold text-gray-900">{formatCurrency(monthlyCost)}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Removed Employees */}
                  {removedEmployees.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold text-gray-500 mb-2">REMOVED EMPLOYEES</h4>
                      <div className="space-y-2">
                        {removedEmployees.map(employee => (
                          <div key={employee.id} className="bg-gray-100 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700">{employee.name}</span>
                              <span className="text-xs text-gray-500">
                                Removed: {formatDate(employee.removedDate)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cost Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">COST SUMMARY</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active Employees:</span>
                      <span className="font-medium text-gray-900">{activeEmployees.length}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span className="text-gray-700">Total Monthly Cost:</span>
                      <span className="text-gray-900">{formatCurrency(totalCost)}</span>
                    </div>
                    {budgetRemaining !== null && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Budget:</span>
                          <span className="font-medium text-gray-900">{formatCurrency(parseFloat(projectDetails.budget))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Remaining:</span>
                          <span className={`font-medium ${budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(budgetRemaining)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Budget Used:</span>
                          <span className={`font-medium ${budgetUsedPercent <= 100 ? 'text-gray-900' : 'text-red-600'}`}>
                            {budgetUsedPercent.toFixed(1)}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">No project details available</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (showForm) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingProject ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="3"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Briefcase className="text-gray-700" size={24} />
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
            {projects.length}
          </span>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Project
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['active', 'on_hold', 'completed', 'archived', 'all'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No projects found. Click "Add Project" to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div
              key={project.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={(e) => handleProjectClick(project.id, e)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: project.color }}
                  />
                  <h3 className="font-bold text-gray-900">{project.name}</h3>
                </div>
                {getStatusBadge(project.status)}
              </div>

              {project.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <Users size={16} />
                <span>{project.active_employees || 0} active employee{project.active_employees !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => handleEdit(project)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit project"
                >
                  <Edit2 size={18} />
                </button>
                {project.status !== 'archived' && (
                  <button
                    onClick={() => handleArchive(project.id, project.name)}
                    className="text-orange-600 hover:text-orange-800"
                    title="Archive project"
                  >
                    <Archive size={18} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(project.id, project.name)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete project"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Detail Modal */}
      <ProjectDetailModal />
    </div>
  );
}
