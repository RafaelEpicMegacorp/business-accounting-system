const ApiError = require('./ApiError');
const pool = require('../config/database');

/**
 * Validate entry data for create/update operations
 * @param {object} data - Entry data to validate
 * @param {boolean} isUpdate - Whether this is an update operation (allows partial data)
 * @throws {ApiError} If validation fails
 */
const validateEntryData = async (data, isUpdate = false) => {
  const errors = [];

  // Required fields for create operation
  if (!isUpdate) {
    if (!data.type) {
      errors.push({ field: 'type', message: 'Entry type is required' });
    }
    if (!data.category) {
      errors.push({ field: 'category', message: 'Category is required' });
    }
    if (!data.description) {
      errors.push({ field: 'description', message: 'Description is required' });
    }
    if (data.base_amount === undefined || data.base_amount === null) {
      errors.push({ field: 'base_amount', message: 'Base amount is required' });
    }
    if (data.total === undefined || data.total === null) {
      errors.push({ field: 'total', message: 'Total amount is required' });
    }
    if (!data.entry_date) {
      errors.push({ field: 'entry_date', message: 'Entry date is required' });
    }
  }

  // Validate type if provided
  if (data.type && !['income', 'expense'].includes(data.type)) {
    errors.push({
      field: 'type',
      message: 'Type must be either "income" or "expense"'
    });
  }

  // Validate description length
  if (data.description && data.description.length > 255) {
    errors.push({
      field: 'description',
      message: 'Description must be 255 characters or less'
    });
  }

  // Validate base_amount
  if (data.base_amount !== undefined && data.base_amount !== null) {
    const amount = parseFloat(data.base_amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push({
        field: 'base_amount',
        message: 'Base amount must be greater than 0'
      });
    }
  }

  // Validate total
  if (data.total !== undefined && data.total !== null) {
    const total = parseFloat(data.total);
    if (isNaN(total) || total <= 0) {
      errors.push({
        field: 'total',
        message: 'Total amount must be greater than 0'
      });
    }
  }

  // Validate entry_date
  if (data.entry_date) {
    const date = new Date(data.entry_date);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'entry_date',
        message: 'Invalid date format'
      });
    }
  }

  // Validate status if provided
  if (data.status && !['completed', 'pending'].includes(data.status)) {
    errors.push({
      field: 'status',
      message: 'Status must be either "completed" or "pending"'
    });
  }

  // Validate currency if provided
  if (data.currency && !/^[A-Z]{3}$/.test(data.currency)) {
    errors.push({
      field: 'currency',
      message: 'Currency must be a valid 3-letter currency code (e.g., USD, EUR)'
    });
  }

  // Validate employee_id exists if provided
  if (data.employee_id) {
    const employeeResult = await pool.query(
      'SELECT id FROM employees WHERE id = $1',
      [data.employee_id]
    );
    if (employeeResult.rows.length === 0) {
      errors.push({
        field: 'employee_id',
        message: 'Employee not found'
      });
    }
  }

  // Validate contract_id exists if provided
  if (data.contract_id) {
    const contractResult = await pool.query(
      'SELECT id FROM contracts WHERE id = $1',
      [data.contract_id]
    );
    if (contractResult.rows.length === 0) {
      errors.push({
        field: 'contract_id',
        message: 'Contract not found'
      });
    }
  }

  // If there are validation errors, throw the first one
  if (errors.length > 0) {
    const firstError = errors[0];
    throw ApiError.badRequest(firstError.message, firstError.field);
  }
};

/**
 * Validate bulk operation data
 * @param {array} ids - Array of entry IDs
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
 * Validate status for bulk status update
 * @param {string} status - Status to validate
 * @throws {ApiError} If validation fails
 */
const validateStatus = (status) => {
  if (!status) {
    throw ApiError.badRequest('Status is required', 'status');
  }

  if (!['completed', 'pending'].includes(status)) {
    throw ApiError.badRequest('Status must be either "completed" or "pending"', 'status');
  }
};

module.exports = {
  validateEntryData,
  validateBulkOperation,
  validateStatus,
};
