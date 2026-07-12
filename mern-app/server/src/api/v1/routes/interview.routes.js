import { Router } from 'express';
import * as interviewController from '../controllers/interview.controller.js';
import {
  createInterviewValidator,
  setPersonaValidator,
  addMessageValidator,
  generateFeedbackValidator,
} from '../validators/interview.validator.js';
import validate from '../../../middleware/validate.middleware.js';
import rateLimit from '../../../middleware/rateLimit.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate(createInterviewValidator), interviewController.create);
router.get('/', interviewController.list);
router.get('/:id', interviewController.getById);
router.patch('/:id/persona', validate(setPersonaValidator), interviewController.setPersona);
router.post('/:id/messages', validate(addMessageValidator), interviewController.addMessage);
router.post(
  '/:id/feedback',
  rateLimit({ name: 'generate-feedback', limit: 10, windowSeconds: 60 }),
  validate(generateFeedbackValidator),
  interviewController.generateFeedback
);

export default router;
