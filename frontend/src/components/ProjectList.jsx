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
            <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
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
    </div>
  );
}
