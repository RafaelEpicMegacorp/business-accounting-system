const ApiError = require('./ApiError');

/**
 * Validate contract data for create/update operations
 * @param {object} data - Contract data to validate
 * @param {boolean} isUpdate - Whether this is an update operation (allows partial data)
 * @throws {ApiError} If validation fails
 */
const validateContractData = (data, isUpdate = false) => {
  const errors = [];

  // Required fields for create operation
  if (!isUpdate) {
    if (!data.client_name) {
      errors.push({ field: 'client_name', message: 'Client name is required' });
    }
    if (data.amount === undefined || data.amount === null) {
      errors.push({ field: 'amount', message: 'Amount is required' });
    }
    if (!data.contract_type) {
      errors.push({ field: 'contract_type', message: 'Contract type is required' });
    }
    if (!data.start_date) {
      errors.push({ field: 'start_date', message: 'Start date is required' });
    }
  }

  // Validate client_name length
  if (data.client_name && data.client_name.length > 255) {
    errors.push({
      field: 'client_name',
      message: 'Client name must be 255 characters or less'
    });
  }

  // Validate amount
  if (data.amount !== undefined && data.amount !== null) {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push({
        field: 'amount',
        message: 'Amount must be greater than 0'
      });
    }
  }

  // Validate contract_type
  if (data.contract_type && !['monthly', 'yearly', 'one-time'].includes(data.contract_type)) {
    errors.push({
      field: 'contract_type',
      message: 'Contract type must be one of: monthly, yearly, one-time'
    });
  }

  // Validate payment_day if provided
  if (data.payment_day !== undefined && data.payment_day !== null) {
    const day = parseInt(data.payment_day);
    if (isNaN(day) || day < 1 || day > 31) {
      errors.push({
        field: 'payment_day',
        message: 'Payment day must be between 1 and 31'
      });
    }
  }

  // Validate start_date
  if (data.start_date) {
    const startDate = new Date(data.start_date);
    if (isNaN(startDate.getTime())) {
      errors.push({
        field: 'start_date',
        message: 'Invalid start date format'
      });
    }
  }

  // Validate end_date if provided
  if (data.end_date) {
    const endDate = new Date(data.end_date);
    if (isNaN(endDate.getTime())) {
      errors.push({
        field: 'end_date',
        message: 'Invalid end date format'
      });
    }

    // Check that end date is after start date
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      if (endDate <= startDate) {
        errors.push({
          field: 'end_date',
          message: 'End date must be after start date'
        });
      }
    }
  }

  // Validate status if provided
  if (data.status && !['active', 'inactive'].includes(data.status)) {
    errors.push({
      field: 'status',
      message: 'Status must be either "active" or "inactive"'
    });
  }

  // If there are validation errors, throw the first one
  if (errors.length > 0) {
    const firstError = errors[0];
    throw ApiError.badRequest(firstError.message, firstError.field);
  }
};

module.exports = {
  validateContractData,
};
