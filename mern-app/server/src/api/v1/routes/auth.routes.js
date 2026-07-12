import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { registerValidator, loginValidator } from '../validators/auth.validator.js';
import validate from '../../../middleware/validate.middleware.js';
import rateLimit from '../../../middleware/rateLimit.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { MAX_LOGIN_ATTEMPTS_PER_MINUTE } from '../../../constants/index.js';

const router = Router();

const credentialLimiter = rateLimit({
  name: 'auth-credentials',
  limit: MAX_LOGIN_ATTEMPTS_PER_MINUTE,
  windowSeconds: 60,
});

router.post('/register', credentialLimiter, validate(registerValidator), authController.register);
router.post('/login', credentialLimiter, validate(loginValidator), authController.login);
router.post('/refresh', rateLimit({ name: 'auth-refresh', limit: 30, windowSeconds: 60 }), authController.refresh);
router.post('/logout', requireAuth, authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);

export default router;
