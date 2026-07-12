export const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

export const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
});

/** Redis key prefixes — keep every key namespaced and greppable. */
export const REDIS_KEYS = Object.freeze({
  REFRESH_WHITELIST: 'auth:refresh:', // + jti → userId (valid refresh tokens)
  ACCESS_BLOCKLIST: 'auth:block:', // + jti → '1' (revoked access tokens)
  RATE_LIMIT: 'rl:', // + name:key:window → counter
});

export const COOKIES = Object.freeze({
  REFRESH_TOKEN: 'refreshToken',
});

export const HTTP_MESSAGES = Object.freeze({
  UNAUTHORIZED: 'Authentication required',
  INVALID_CREDENTIALS: 'Invalid email or password',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  TOO_MANY_REQUESTS: 'Too many requests. Please slow down.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
});

export const MAX_LOGIN_ATTEMPTS_PER_MINUTE = 10;
export const BCRYPT_SALT_ROUNDS = 12;
