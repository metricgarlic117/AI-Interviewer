import { body } from 'express-validator';

export const analyzeResumeValidator = [
  body('text')
    .isString()
    .isLength({ min: 50, max: 30000 })
    .withMessage('Resume text must be between 50 and 30000 characters'),
  body('fileName')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('File name is too long'),
  body('jobDescription')
    .optional()
    .isString()
    .isLength({ max: 15000 })
    .withMessage('Job description is too long'),
];

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// ~6 MB of raw image once base64 overhead is accounted for.
const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024;

export const extractTextValidator = [
  body('base64Image')
    .isString()
    .notEmpty()
    .withMessage('Image data is required')
    .isLength({ max: MAX_IMAGE_BASE64_CHARS })
    .withMessage('Image is too large. Maximum size is 6 MB.'),
  body('mimeType')
    .isIn(ALLOWED_IMAGE_TYPES)
    .withMessage('Unsupported image type. Use PNG, JPEG, or WebP.'),
];
