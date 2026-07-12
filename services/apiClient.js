import { auth } from './firebase';

/**
 * fetch() wrapper that attaches the current user's Firebase ID token.
 * All internal API routes require this header — see lib/server/auth.js.
 */
export async function authedFetch(url, options = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }

  const token = await user.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
