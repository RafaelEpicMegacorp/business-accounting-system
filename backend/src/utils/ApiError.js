/**
 * Custom API Error class for consistent error handling
 * Extends the native Error class with additional properties for structured error responses
 */
class ApiError extends Error {
  /**
   * Create an API Error
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (400, 404, 409, 500, etc.)
   * @param {string|null} field - Optional field name that caused the error
   * @param {string|null} code - Optional error code for programmatic handling
   */
  constructor(message, statusCode, field = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.field = field;
    this.code = code;
    this.isOperational = true; // Distinguishes operational errors from programming errors

    // Capture stack trace (excluding constructor call from it)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a Bad Request error (400)
   * @param {string} message - Error message
   * @param {string|null} field - Field name that caused the error
   * @returns {ApiError}
   */
  static badRequest(message, field = null) {
    return new ApiError(message, 400, field, 'BAD_REQUEST');
  }

  /**
   * Create a Not Found error (404)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static notFound(message) {
    return new ApiError(message, 404, null, 'NOT_FOUND');
  }

  /**
   * Create a Conflict error (409)
   * @param {string} message - Error message
   * @param {string|null} field - Field name that caused the conflict
   * @returns {ApiError}
   */
  static conflict(message, field = null) {
    return new ApiError(message, 409, field, 'CONFLICT');
  }

  /**
   * Create an Internal Server Error (500)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static internal(message = 'Internal server error') {
    return new ApiError(message, 500, null, 'INTERNAL_ERROR');
  }

  /**
   * Create an Unauthorized error (401)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(message, 401, null, 'UNAUTHORIZED');
  }

  /**
   * Create a Forbidden error (403)
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(message, 403, null, 'FORBIDDEN');
  }
}

module.exports = ApiError;
