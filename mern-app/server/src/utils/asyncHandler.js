/**
 * Wraps an async controller so rejected promises reach the central error
 * middleware without per-controller try/catch blocks.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
