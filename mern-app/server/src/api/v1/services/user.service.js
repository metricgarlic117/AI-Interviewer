import User from '../../../models/User.js';
import ApiError from '../../../utils/ApiError.js';
import { revokeAllSessions } from './auth.service.js';

export async function getById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user.toJSON();
}

const UPDATABLE_FIELDS = ['name', 'avatarUrl'];

export async function updateProfile(userId, updates) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  for (const field of UPDATABLE_FIELDS) {
    if (updates[field] !== undefined) {
      user[field] = updates[field];
    }
  }
  await user.save();
  return user.toJSON();
}

/**
 * Changes the password after verifying the current one, then revokes every
 * other session so a stolen refresh token dies with the old password.
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
  await revokeAllSessions(userId);
}
