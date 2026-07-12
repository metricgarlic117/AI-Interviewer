import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/**
 * Runs an express-validator chain array, then converts any collected
 * failures into a 422 ApiError with field-level details.
 *
 * Usage: router.post('/login', validate(loginValidator), controller.login)
 */
const validate = (validations) => [
  ...validations,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = result.array({ onlyFirstError: true }).map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(ApiError.unprocessable('Validation failed', errors));
  },
];

export default validate;
