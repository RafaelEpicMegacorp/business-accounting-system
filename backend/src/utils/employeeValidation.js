const ApiError = require('./ApiError');
const pool = require('../config/database');

/**
 * Validate employee data for create/update operations
 * @param {object} data - Employee data to validate
 * @param {boolean} isUpdate - Whether this is an update operation (allows partial data)
 * @param {number} employeeId - Employee ID for update operations (to exclude from duplicate check)
 * @throws {ApiError} If validation fails
 */
const validateEmployeeData = async (data, isUpdate = false, employeeId = null) => {
  const errors = [];

  // Required fields for create operation
  if (!isUpdate) {
    if (!data.name) {
      errors.push({ field: 'name', message: 'Employee name is required' });
    }
    if (!data.pay_type) {
      errors.push({ field: 'pay_type', message: 'Pay type is required' });
    }
    if (data.pay_rate === undefined || data.pay_rate === null) {
      errors.push({ field: 'pay_rate', message: 'Pay rate is required' });
    }
    if (!data.start_date) {
      errors.push({ field: 'start_date', message: 'Start date is required' });
    }
  }

  // Validate name length
  if (data.name && data.name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Name must be 255 characters or less'
    });
  }

  // Validate email format if provided
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address'
      });
    }

    // Check for duplicate email
    const emailCheckQuery = employeeId
      ? 'SELECT id FROM employees WHERE email = $1 AND id != $2'
      : 'SELECT id FROM employees WHERE email = $1';
    const emailCheckParams = employeeId ? [data.email, employeeId] : [data.email];

    const emailResult = await pool.query(emailCheckQuery, emailCheckParams);
    if (emailResult.rows.length > 0) {
      errors.push({
        field: 'email',
        message: 'An employee with this email already exists'
      });
    }
  }

  // Validate position length
  if (data.position && data.position.length > 255) {
    errors.push({
      field: 'position',
      message: 'Position must be 255 characters or less'
    });
  }

  // Validate pay_type
  if (data.pay_type && !['monthly', 'weekly', 'hourly'].includes(data.pay_type)) {
    errors.push({
      field: 'pay_type',
      message: 'Pay type must be one of: monthly, weekly, hourly'
    });
  }

  // Validate pay_rate
  if (data.pay_rate !== undefined && data.pay_rate !== null) {
    const rate = parseFloat(data.pay_rate);
    if (isNaN(rate) || rate <= 0) {
      errors.push({
        field: 'pay_rate',
        message: 'Pay rate must be greater than 0'
      });
    }
  }

  // Validate pay_multiplier if provided
  if (data.pay_multiplier !== undefined && data.pay_multiplier !== null) {
    const multiplier = parseFloat(data.pay_multiplier);
    if (isNaN(multiplier) || multiplier < 0) {
      errors.push({
        field: 'pay_multiplier',
        message: 'Pay multiplier must be a positive number'
      });
    }
  }

  // Validate start_date
  if (data.start_date) {
    const date = new Date(data.start_date);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'start_date',
        message: 'Invalid start date format'
      });
    }
  }

  // Validate termination_date if provided
  if (data.termination_date) {
    const termDate = new Date(data.termination_date);
    if (isNaN(termDate.getTime())) {
      errors.push({
        field: 'termination_date',
        message: 'Invalid termination date format'
      });
    }

    // Check that termination date is after start date
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      if (termDate < startDate) {
        errors.push({
          field: 'termination_date',
          message: 'Termination date must be after start date'
        });
      }
    }
  }

  // If there are validation errors, throw the first one
  if (errors.length > 0) {
    const firstError = errors[0];
    throw ApiError.badRequest(firstError.message, firstError.field);
  }
};

/**
 * Validate bulk operation data for employees
 * @param {array} ids - Array of employee IDs
 * @throws {ApiError} If validation fails
 */
const validateBulkOperation = (ids) => {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('IDs array is required and must not be empty', 'ids');
  }

  // Validate each ID is a valid number
  const invalidIds = ids.filter(id => isNaN(parseInt(id)));
  if (invalidIds.length > 0) {
    throw ApiError.badRequest('All IDs must be valid numbers', 'ids');
  }
};

/**
 * Validate termination data
 * @param {object} data - Termination data
 * @throws {ApiError} If validation fails
 */
const validateTerminationData = (data) => {
  if (!data.terminationDate) {
    throw ApiError.badRequest('Termination date is required', 'terminationDate');
  }

  const termDate = new Date(data.terminationDate);
  if (isNaN(termDate.getTime())) {
    throw ApiError.badRequest('Invalid termination date format', 'terminationDate');
  }

  // Validate severance amount if provided
  if (data.severanceAmount !== undefined && data.severanceAmount !== null) {
    const amount = parseFloat(data.severanceAmount);
    if (isNaN(amount) || amount < 0) {
      throw ApiError.badRequest('Severance amount must be a positive number or zero', 'severanceAmount');
    }
  }
};

module.exports = {
  validateEmployeeData,
  validateBulkOperation,
  validateTerminationData,
};
