import ApiError from '../utils/ApiError.js';

/** Catch-all for unmatched routes — forwards a 404 to the error handler. */
export default function notFoundMiddleware(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
