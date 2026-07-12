import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../../../config/env.js';
import { redisClient } from '../../../config/redis.js';
import User from '../../../models/User.js';
import Token from '../../../models/Token.js';
import ApiError from '../../../utils/ApiError.js';
import logger from '../../../utils/logger.js';
import { REDIS_KEYS, HTTP_MESSAGES } from '../../../constants/index.js';

/**
 * Token model:
 *  - Access token (JWT, short-lived): sent in the Authorization header.
 *    Stateless except for a Redis blocklist consulted on every request so
 *    logout takes effect immediately.
 *  - Refresh token (JWT, long-lived): httpOnly cookie scoped to /api/v1/auth.
 *    Stateful whitelist in Redis (jti → userId). Rotated on every use; a
 *    refresh token presented after rotation is treated as theft and revokes
 *    the user's every session. Mongo (Token collection) is the audit trail
 *    and powers "log out everywhere".
 */

const TTL_UNITS = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses "15m" / "7d" style TTLs into seconds. */
export function ttlToSeconds(ttl) {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: "${ttl}" (expected e.g. 15m, 7d)`);
  }
  return Number(match[1]) * TTL_UNITS[match[2]];
}

function signAccessToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ role: user.role, jti }, env.ACCESS_TOKEN_SECRET, {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
  return { token, jti };
}

async function issueRefreshToken(user, meta = {}) {
  const jti = crypto.randomUUID();
  const ttlSeconds = ttlToSeconds(env.REFRESH_TOKEN_TTL);
  const token = jwt.sign({ jti }, env.REFRESH_TOKEN_SECRET, {
    subject: user.id,
    expiresIn: env.REFRESH_TOKEN_TTL,
  });

  await redisClient.set(`${REDIS_KEYS.REFRESH_WHITELIST}${jti}`, user.id, {
    EX: ttlSeconds,
  });
  await Token.create({
    user: user.id,
    jti,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return { token, jti };
}

async function buildAuthTokens(user, meta) {
  const access = signAccessToken(user);
  const refresh = await issueRefreshToken(user, meta);
  return { accessToken: access.token, refreshToken: refresh.token };
}

export async function register({ name, email, password }, meta) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const user = await User.create({ name, email, password });
  const tokens = await buildAuthTokens(user, meta);
  return { user: user.toJSON(), tokens };
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    // Same message for both cases — do not reveal which field was wrong.
    throw ApiError.unauthorized(HTTP_MESSAGES.INVALID_CREDENTIALS);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await buildAuthTokens(user, meta);
  return { user: user.toJSON(), tokens };
}

/**
 * Rotates a refresh token: validates signature + whitelist, revokes the old
 * token, and issues a fresh access/refresh pair.
 */
export async function refresh(refreshTokenValue, meta) {
  if (!refreshTokenValue) {
    throw ApiError.unauthorized(HTTP_MESSAGES.UNAUTHORIZED);
  }

  let payload;
  try {
    payload = jwt.verify(refreshTokenValue, env.REFRESH_TOKEN_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired session');
  }

  const whitelistKey = `${REDIS_KEYS.REFRESH_WHITELIST}${payload.jti}`;
  const whitelistedUserId = await redisClient.get(whitelistKey);

  if (!whitelistedUserId) {
    // Valid signature but not whitelisted: this token was already rotated
    // or revoked. Treat as replay/theft — kill every session for the user.
    logger.warn(`[auth] Refresh token reuse detected for user ${payload.sub}`);
    await revokeAllSessions(payload.sub);
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    await redisClient.del(whitelistKey);
    throw ApiError.unauthorized(HTTP_MESSAGES.UNAUTHORIZED);
  }

  // Rotation: invalidate the presented token before issuing its successor.
  await redisClient.del(whitelistKey);
  const tokens = await buildAuthTokens(user, meta);
  const newRefreshPayload = jwt.decode(tokens.refreshToken);
  await Token.updateOne(
    { jti: payload.jti },
    { revokedAt: new Date(), replacedByJti: newRefreshPayload.jti }
  );

  return { user: user.toJSON(), tokens };
}

/**
 * Logs out the current session: blocklists the live access token for its
 * remaining lifetime and revokes the presented refresh token.
 */
export async function logout({ accessJti, accessExp, refreshTokenValue }) {
  const remainingSeconds = accessExp - Math.floor(Date.now() / 1000);
  if (accessJti && remainingSeconds > 0) {
    await redisClient.set(`${REDIS_KEYS.ACCESS_BLOCKLIST}${accessJti}`, '1', {
      EX: remainingSeconds,
    });
  }

  if (refreshTokenValue) {
    try {
      const payload = jwt.verify(refreshTokenValue, env.REFRESH_TOKEN_SECRET);
      await redisClient.del(`${REDIS_KEYS.REFRESH_WHITELIST}${payload.jti}`);
      await Token.updateOne({ jti: payload.jti }, { revokedAt: new Date() });
    } catch {
      // Expired/garbled refresh cookie during logout is not an error.
    }
  }
}

/** Revokes every refresh token a user has, across all devices. */
export async function revokeAllSessions(userId) {
  const activeTokens = await Token.find({ user: userId, revokedAt: null });
  if (activeTokens.length > 0) {
    await Promise.all(
      activeTokens.map((t) =>
        redisClient.del(`${REDIS_KEYS.REFRESH_WHITELIST}${t.jti}`)
      )
    );
    await Token.updateMany(
      { user: userId, revokedAt: null },
      { revokedAt: new Date() }
    );
  }
}
