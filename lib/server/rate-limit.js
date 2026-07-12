/**
 * Fixed-window in-memory rate limiter.
 *
 * Suitable for a single-instance deployment (one Node server / one region).
 * If you scale to multiple instances or a serverless platform with many
 * concurrent lambdas, swap this for a shared store (Upstash Redis,
 * Memorystore, etc.) behind the same checkRateLimit signature.
 */

const WINDOW_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const buckets = new Map();
let lastCleanup = Date.now();

function cleanup(now) {
  if (now - lastCleanup < WINDOW_CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * @param {string} key - Unique caller identity, e.g. `${routeName}:${uid}`
 * @param {{limit?: number, windowMs?: number}} [options]
 * @returns {{ok: boolean, retryAfterSeconds: number}}
 */
export function checkRateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Test helper — clears all rate-limit state. */
export function resetRateLimits() {
  buckets.clear();
}
