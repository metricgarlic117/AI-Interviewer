import { adminAuth } from './firebase-admin';

/** Error type the API handler maps to an HTTP status. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>`.
 *
 * Every API route must call this (directly or via createApiHandler) — client
 * side route guards are UX only; this is the actual security boundary.
 *
 * @param {Request} request
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken>}
 */
export async function requireAuth(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new ApiError('Authentication required', 401);
  }

  try {
    return await adminAuth().verifyIdToken(match[1]);
  } catch (err) {
    console.warn('[auth] ID token verification failed:', err.code || err.message);
    throw new ApiError('Invalid or expired credentials', 401);
  }
}
