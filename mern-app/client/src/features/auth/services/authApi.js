import { api } from '../../../lib/axios';

export async function register({ name, email, password }) {
  const res = await api.post('/auth/register', { name, email, password });
  return res.data.data; // { user, accessToken }
}

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data; // { user, accessToken }
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function fetchMe() {
  const res = await api.get('/users/me');
  return res.data.data.user;
}

export async function updateProfile(updates) {
  const res = await api.patch('/users/me', updates);
  return res.data.data.user;
}

export async function changePassword({ currentPassword, newPassword }) {
  const res = await api.patch('/users/me/password', { currentPassword, newPassword });
  return res.data.message;
}
