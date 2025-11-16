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
    if (!data.clientName) {
      errors.push({ field: 'clientName', message: 'Client name is required' });
    }
    if (data.amount === undefined || data.amount === null) {
      errors.push({ field: 'amount', message: 'Amount is required' });
    }
    if (!data.contractType) {
      errors.push({ field: 'contractType', message: 'Contract type is required' });
    }
    if (!data.startDate) {
      errors.push({ field: 'startDate', message: 'Start date is required' });
    }
  }

  // Validate clientName length
  if (data.clientName && data.clientName.length > 255) {
    errors.push({
      field: 'clientName',
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

  // Validate contractType
  if (data.contractType && !['monthly', 'yearly', 'one-time'].includes(data.contractType)) {
    errors.push({
      field: 'contractType',
      message: 'Contract type must be one of: monthly, yearly, one-time'
    });
  }

  // Validate paymentDay if provided
  if (data.paymentDay !== undefined && data.paymentDay !== null) {
    const day = parseInt(data.paymentDay);
    if (isNaN(day) || day < 1 || day > 31) {
      errors.push({
        field: 'paymentDay',
        message: 'Payment day must be between 1 and 31'
      });
    }
  }

  // Validate startDate
  if (data.startDate) {
    const startDate = new Date(data.startDate);
    if (isNaN(startDate.getTime())) {
      errors.push({
        field: 'startDate',
        message: 'Invalid start date format'
      });
    }
  }

  // Validate endDate if provided
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
