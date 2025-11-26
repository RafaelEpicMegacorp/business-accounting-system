const projectModel = require('../models/projectModel');
const ApiError = require('../utils/ApiError');
const { validateProjectData } = require('../utils/projectValidation');

const projectController = {
  /**
   * Get all projects
   */
  async getAll(req, res, next) {
    try {
      const { status } = req.query;
      const projects = await projectModel.getAll(status);
      res.json(projects);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single project by ID
   */
  async getById(req, res, next) {
    try {
      const project = await projectModel.getById(req.params.id);
      if (!project) {
        throw ApiError.notFound('Project not found');
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get project with employee details
   */
  async getWithEmployees(req, res, next) {
    try {
      const project = await projectModel.getWithEmployees(req.params.id);
      if (!project) {
        throw ApiError.notFound('Project not found');
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create new project
   */
  async create(req, res, next) {
    try {
      await validateProjectData(req.body, false);
      const project = await projectModel.create(req.body);
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update existing project
   */
  async update(req, res, next) {
    try {
      await validateProjectData(req.body, true, req.params.id);
      const project = await projectModel.update(req.params.id, req.body);
      if (!project) {
        throw ApiError.notFound('Project not found');
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete project
   */
  async delete(req, res, next) {
    try {
      // Check if project has active employee assignments
      const projectWithEmployees = await projectModel.getById(req.params.id);
      if (!projectWithEmployees) {
        throw ApiError.notFound('Project not found');
      }

      if (parseInt(projectWithEmployees.active_employees) > 0) {
        throw ApiError.badRequest('Cannot delete project with assigned employees. Remove employees or archive the project instead.');
      }

      const project = await projectModel.delete(req.params.id);
      res.json({ message: 'Project deleted successfully', project });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Archive project (soft delete)
   */
  async archive(req, res, next) {
    try {
      const project = await projectModel.archive(req.params.id);
      if (!project) {
        throw ApiError.notFound('Project not found');
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Assign employee to project
   */
  async assignEmployee(req, res, next) {
    try {
      const { employeeId, isPrimary, role, allocationPercentage } = req.body;

      if (!employeeId) {
        throw ApiError.badRequest('Employee ID is required');
      }

      const assignment = await projectModel.assignEmployee(
        req.params.id,
        employeeId,
        { isPrimary, role, allocationPercentage }
      );
      res.json(assignment);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Remove employee from project
   */
  async removeEmployee(req, res, next) {
    try {
      const assignment = await projectModel.removeEmployee(
        req.params.id,
        req.params.employeeId
      );
      if (!assignment) {
        throw ApiError.notFound('Assignment not found or already removed');
      }
      res.json({ message: 'Employee removed from project', assignment });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get project statistics
   */
  async getStats(req, res, next) {
    try {
      const stats = await projectModel.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = projectController;
