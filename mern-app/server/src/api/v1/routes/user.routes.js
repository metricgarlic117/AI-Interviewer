import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { updateMeValidator, changePasswordValidator } from '../validators/user.validator.js';
import validate from '../../../middleware/validate.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/me', userController.getMe);
router.patch('/me', validate(updateMeValidator), userController.updateMe);
router.patch('/me/password', validate(changePasswordValidator), userController.changePassword);

export default router;
