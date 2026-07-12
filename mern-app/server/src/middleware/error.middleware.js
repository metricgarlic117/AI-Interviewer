import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { HTTP_MESSAGES } from '../constants/index.js';

/**
 * Central error handler — must be registered last. Operational ApiErrors
 * are returned as-is; everything else is logged in full and returned as an
 * opaque 500 so internals never leak to clients.
 */
// eslint-disable-next-line no-unused-vars
export default function errorMiddleware(err, req, res, _next) {
  let error = err;

  // Normalize common non-ApiError failures into operational errors.
  if (err?.name === 'CastError') {
    error = ApiError.badRequest('Invalid identifier format');
  } else if (err?.code === 11000) {
    error = ApiError.conflict('A record with that value already exists');
  } else if (err?.type === 'entity.too.large') {
    error = new ApiError(413, 'Request body too large');
  } else if (err?.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Request body must be valid JSON');
  }

  if (!(error instanceof ApiError)) {
    logger.error(`[${req.method} ${req.originalUrl}]`, err);
    error = new ApiError(500, HTTP_MESSAGES.INTERNAL_ERROR);
  } else if (error.statusCode >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors ?? [],
    ...(env.IS_PRODUCTION ? {} : { stack: err.stack }),
  });
}
