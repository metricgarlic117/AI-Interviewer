import { redisClient } from '../config/redis.js';
import { REDIS_KEYS, HTTP_MESSAGES } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

/**
 * Redis-backed fixed-window rate limiter, safe across multiple API
 * instances. Keys by authenticated user when available, else by IP.
 *
 * Fails open: if Redis is briefly unavailable the request proceeds —
 * availability is preferred over throttling accuracy here.
 */
export default function rateLimit({ name, limit = 60, windowSeconds = 60 }) {
  return asyncHandler(async (req, res, next) => {
    const identity = req.user?.id || req.ip;
    const windowIndex = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `${REDIS_KEYS.RATE_LIMIT}${name}:${identity}:${windowIndex}`;

    let count;
    try {
      count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }
    } catch (err) {
      logger.warn('[rate-limit] Redis unavailable, failing open', err.message);
      return next();
    }

    if (count > limit) {
      const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
      res.set('Retry-After', String(retryAfter));
      throw ApiError.tooManyRequests(HTTP_MESSAGES.TOO_MANY_REQUESTS);
    }

    return next();
  });
}
