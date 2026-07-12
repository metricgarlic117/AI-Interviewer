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
