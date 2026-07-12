import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { updateMeValidator } from '../validators/user.validator.js';
import validate from '../../../middleware/validate.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/me', userController.getMe);
router.patch('/me', validate(updateMeValidator), userController.updateMe);

export default router;
