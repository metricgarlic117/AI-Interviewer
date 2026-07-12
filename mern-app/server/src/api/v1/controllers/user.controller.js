import * as userService from '../services/user.service.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import asyncHandler from '../../../utils/asyncHandler.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.user.id);
  return new ApiResponse(200, { user }).send(res);
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, avatarUrl } = req.body;
  const user = await userService.updateProfile(req.user.id, { name, avatarUrl });
  return new ApiResponse(200, { user }, 'Profile updated').send(res);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await userService.changePassword(req.user.id, { currentPassword, newPassword });
  return new ApiResponse(
    200,
    null,
    'Password updated. Other sessions have been logged out.'
  ).send(res);
});
