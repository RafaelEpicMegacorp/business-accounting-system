/**
 * Validation utility functions for form fields
 * All functions return null if valid, or an error message string if invalid
 */

/**
 * Check if a value is required (not empty)
 * @param {any} value - Value to check
 * @returns {string|null} Error message or null if valid
 */
export const isRequired = (value) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return 'This field is required';
  }
  return null;
};

/**
 * Validate email format
 * @param {string} value - Email to validate
 * @returns {string|null} Error message or null if valid
 */
export const isValidEmail = (value) => {
  if (!value) return null; // Only validate if value exists
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return 'Please enter a valid email address';
  }
  return null;
};

/**
 * Validate amount is a positive number
 * @param {string|number} value - Amount to validate
 * @returns {string|null} Error message or null if valid
 */
export const isValidAmount = (value) => {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    return 'Amount must be greater than 0';
  }
  return null;
};

/**
 * Validate date format
 * @param {string} value - Date to validate
 * @returns {string|null} Error message or null if valid
 */
export const isValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return 'Please enter a valid date';
  }
  return null;
};

/**
 * Create a range validator for numbers
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {function} Validator function
 */
export const isInRange = (min, max) => (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return 'Please enter a valid number';
  if (num < min || num > max) {
    return `Value must be between ${min} and ${max}`;
  }
  return null;
};

/**
 * Validate that end date is after start date
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {string|null} Error message or null if valid
 */
export const isEndDateAfterStart = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) {
    return 'End date must be after start date';
  }
  return null;
};

/**
 * Validate that a value is one of the allowed options
 * @param {array} allowedValues - Array of allowed values
 * @returns {function} Validator function
 */
export const isOneOf = (allowedValues) => (value) => {
  if (!allowedValues.includes(value)) {
    return `Value must be one of: ${allowedValues.join(', ')}`;
  }
  return null;
};

/**
 * Combine multiple validators for a single field
 * @param {...function} validators - Validator functions to combine
 * @returns {function} Combined validator function
 */
export const combineValidators = (...validators) => (value) => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};

export default {
  isRequired,
  isValidEmail,
  isValidAmount,
  isValidDate,
  isInRange,
  isEndDateAfterStart,
  isOneOf,
  combineValidators,
};
