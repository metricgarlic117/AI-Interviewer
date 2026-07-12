/**
 * Operational error with an HTTP status code. Anything a controller or
 * service throws intentionally should be an ApiError — the central error
 * middleware maps it to a response. Non-ApiError exceptions are treated as
 * programmer errors and returned as opaque 500s.
 */
export default class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {Array<object>} [errors] - Optional field-level details (validation).
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static unprocessable(message, errors = []) {
    return new ApiError(422, message, errors);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }
}
