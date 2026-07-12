import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { redisClient } from '../config/redis.js';
import { REDIS_KEYS, HTTP_MESSAGES, ROLES } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Verifies the access token from `Authorization: Bearer <token>`, rejects
 * blocklisted (logged-out) tokens, and attaches { id, role, jti, exp } as
 * req.user. This is the security boundary for every protected route.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw ApiError.unauthorized(HTTP_MESSAGES.UNAUTHORIZED);
  }

  let payload;
  try {
    payload = jwt.verify(match[1], env.ACCESS_TOKEN_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const isBlocked = await redisClient.exists(
    `${REDIS_KEYS.ACCESS_BLOCKLIST}${payload.jti}`
  );
  if (isBlocked) {
    throw ApiError.unauthorized('Session has been revoked');
  }

  req.user = {
    id: payload.sub,
    role: payload.role,
    jti: payload.jti,
    exp: payload.exp,
  };
  return next();
});

/** Restricts a route to the given roles. Use after requireAuth. */
export const requireRole = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw ApiError.forbidden(HTTP_MESSAGES.FORBIDDEN);
    }
    return next();
  });

export const requireAdmin = requireRole(ROLES.ADMIN);
