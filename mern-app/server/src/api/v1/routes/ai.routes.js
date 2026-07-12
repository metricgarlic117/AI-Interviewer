import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { extractTextValidator } from '../validators/resume.validator.js';
import validate from '../../../middleware/validate.middleware.js';
import rateLimit from '../../../middleware/rateLimit.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/gemini-live-token',
  rateLimit({ name: 'gemini-live-token', limit: 10, windowSeconds: 60 }),
  aiController.geminiLiveToken
);
router.post(
  '/assemblyai-token',
  rateLimit({ name: 'assemblyai-token', limit: 10, windowSeconds: 60 }),
  aiController.assemblyAiToken
);
router.post(
  '/extract-text',
  rateLimit({ name: 'extract-text', limit: 15, windowSeconds: 60 }),
  validate(extractTextValidator),
  aiController.extractText
);

export default router;
