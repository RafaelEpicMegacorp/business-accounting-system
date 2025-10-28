const ApiError = require('../utils/ApiError');

/**
 * Global error handling middleware
 * Catches all errors thrown in route handlers and formats them consistently
 *
 * @param {Error} err - The error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let field = err.field || null;
  let code = err.code || null;

  // Handle specific error types

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    statusCode = 409;
    message = 'A record with this value already exists';
    code = 'DUPLICATE_ENTRY';

    // Try to extract field name from PostgreSQL error detail
    if (err.detail) {
      const fieldMatch = err.detail.match(/Key \(([^)]+)\)/);
      if (fieldMatch) {
        field = fieldMatch[1];
      }
    }
  }

  // PostgreSQL foreign key constraint violation
  if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced record does not exist';
    code = 'INVALID_REFERENCE';

    // Try to extract field name from PostgreSQL error detail
    if (err.detail) {
      const fieldMatch = err.detail.match(/Key \(([^)]+)\)/);
      if (fieldMatch) {
        field = fieldMatch[1];
      }
    }
  }

  // PostgreSQL not null constraint violation
  if (err.code === '23502') {
    statusCode = 400;
    message = 'Required field is missing';
    code = 'REQUIRED_FIELD';
    field = err.column || null;
  }

  // Don't leak stack traces in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
    // Log the actual error for debugging
    console.error('Production error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    // Log error details in development
    console.error('Error:', {
      message: err.message,
      statusCode,
      field,
      code,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Build response object
  const response = {
    error: message,
  };

  // Add optional fields only if they exist
  if (field) response.field = field;
  if (code) response.code = code;

  // Include stack trace in development mode
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Middleware to handle 404 errors for undefined routes
 * Should be placed after all other routes
 */
const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(`Route ${req.method} ${req.path} not found`);
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch rejected promises
 *
 * @param {function} fn - Async route handler function
 * @returns {function} Wrapped function that catches errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
