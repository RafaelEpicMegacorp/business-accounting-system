const ApiError = require('./ApiError');
const projectModel = require('../models/projectModel');

/**
 * Validate project data for create/update operations
 * @param {object} data - Project data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @param {number} projectId - Project ID for update operations (to exclude from duplicate check)
 * @throws {ApiError} If validation fails
 */
const validateProjectData = async (data, isUpdate = false, projectId = null) => {
  const errors = [];

  // Required fields for create operation
  if (!isUpdate) {
    if (!data.name) {
      errors.push({ field: 'name', message: 'Project name is required' });
    }
  }

  // Validate name
  if (data.name) {
    if (data.name.length < 2 || data.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Project name must be between 2 and 100 characters'
      });
    }

    // Check for duplicate name
    const isUnique = await projectModel.isNameUnique(data.name, projectId);
    if (!isUnique) {
      errors.push({
        field: 'name',
        message: 'A project with this name already exists'
      });
    }
  }

  // Validate status
  const validStatuses = ['active', 'on_hold', 'completed', 'archived'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${validStatuses.join(', ')}`
    });
  }

  // Validate color (hex format)
  if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
    errors.push({
      field: 'color',
      message: 'Color must be a valid hex color (e.g., #3B82F6)'
    });
  }

  // Validate budget
  if (data.budget !== undefined && data.budget !== null) {
    const budget = parseFloat(data.budget);
    if (isNaN(budget) || budget < 0) {
      errors.push({
        field: 'budget',
        message: 'Budget must be a positive number'
      });
    }
  }

  // Validate start_date
  if (data.startDate) {
    const date = new Date(data.startDate);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'startDate',
        message: 'Invalid start date format'
      });
    }
  }

  // Validate end_date
  if (data.endDate) {
    const endDate = new Date(data.endDate);
    if (isNaN(endDate.getTime())) {
      errors.push({
        field: 'endDate',
        message: 'Invalid end date format'
      });
    }

    // Check that end date is after start date
    if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (endDate <= startDate) {
        errors.push({
          field: 'endDate',
          message: 'End date must be after start date'
        });
      }
    }
  }

  // Validate allocation percentage
  if (data.allocationPercentage !== undefined && data.allocationPercentage !== null) {
    const allocation = parseFloat(data.allocationPercentage);
    if (isNaN(allocation) || allocation <= 0 || allocation > 100) {
      errors.push({
        field: 'allocationPercentage',
        message: 'Allocation percentage must be between 0 and 100'
      });
    }
  }

  // If there are validation errors, throw the first one
  if (errors.length > 0) {
    const firstError = errors[0];
    throw ApiError.badRequest(firstError.message, firstError.field);
  }
};

module.exports = {
  validateProjectData
};
