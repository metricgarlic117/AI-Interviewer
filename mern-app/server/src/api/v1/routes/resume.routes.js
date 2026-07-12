import { Router } from 'express';
import * as resumeController from '../controllers/resume.controller.js';
import { analyzeResumeValidator } from '../validators/resume.validator.js';
import validate from '../../../middleware/validate.middleware.js';
import rateLimit from '../../../middleware/rateLimit.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/analyze',
  rateLimit({ name: 'analyze-resume', limit: 10, windowSeconds: 60 }),
  validate(analyzeResumeValidator),
  resumeController.analyze
);
router.get('/latest', resumeController.getLatest);

export default router;
