import { body } from 'express-validator';

export const updateMeValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('avatarUrl')
    .optional({ values: 'null' })
    .isURL({ protocols: ['https'] })
    .withMessage('Avatar must be a valid https URL'),
];
