import User from '../../../models/User.js';
import ApiError from '../../../utils/ApiError.js';

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
