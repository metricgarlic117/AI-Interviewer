import { body } from 'express-validator';

const INTERVIEW_TYPES = ['Technical', 'Behavioral', 'Mixed'];
const INTERVIEW_LEVELS = ['Intern', 'Junior', 'Senior'];
const INTERVIEW_MODES = ['Friendly Coach', 'Realistic Interviewer', 'Stress Mode'];

export const createInterviewValidator = [
  body('config').isObject().withMessage('Config is required'),
  body('config.role')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Role must be between 2 and 120 characters'),
  body('config.type').isIn(INTERVIEW_TYPES).withMessage('Invalid interview type'),
  body('config.level').isIn(INTERVIEW_LEVELS).withMessage('Invalid interview level'),
  body('config.mode').isIn(INTERVIEW_MODES).withMessage('Invalid interview mode'),
  body('config.techStack')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Tech stack is too long'),
  body('config.questionCount')
    .optional()
    .isInt({ min: 3, max: 10 })
    .withMessage('Question count must be between 3 and 10'),
  body('config.jobDescription')
    .optional()
    .isString()
    .isLength({ max: 15000 })
    .withMessage('Job description is too long'),
  body('config.resumeText')
    .optional()
    .isString()
    .isLength({ max: 30000 })
    .withMessage('Resume text is too long'),
];

export const setPersonaValidator = [
  body('interviewerPersona')
    .isString()
    .isLength({ min: 10, max: 20000 })
    .withMessage('Persona must be between 10 and 20000 characters'),
];

export const addMessageValidator = [
  body('role').isIn(['user', 'model']).withMessage('Role must be user or model'),
  body('text')
    .isString()
    .isLength({ min: 1, max: 8000 })
    .withMessage('Message text must be between 1 and 8000 characters'),
  body('timestamp').optional().isInt().withMessage('Timestamp must be a number'),
];

export const generateFeedbackValidator = [
  body('messages').optional().isArray({ max: 300 }).withMessage('Messages must be an array'),
  body('messages.*.role')
    .optional()
    .isIn(['user', 'model'])
    .withMessage('Message role must be user or model'),
  body('messages.*.text')
    .optional()
    .isString()
    .isLength({ max: 8000 })
    .withMessage('Message text is too long'),
];
