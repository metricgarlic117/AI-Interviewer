import { NextResponse } from 'next/server';
import { requireAuth, ApiError } from './auth';
import { checkRateLimit } from './rate-limit';

const DEFAULT_MAX_BODY_BYTES = 256 * 1024; // 256 KB

/**
 * Wraps an API route handler with the production plumbing every route needs:
 *
 *  1. Firebase ID-token verification (401 on failure)
 *  2. Per-user rate limiting (429 with Retry-After)
 *  3. JSON body parsing with a size cap (400 / 413)
 *  4. Error mapping that never leaks internal error messages in 500s
 *
 * @param {string} routeName - Used for rate-limit bucketing and logs.
 * @param {(ctx: {request: Request, user: object, body: object}) => Promise<Response>} handler
 * @param {{rateLimit?: {limit: number, windowMs: number}, maxBodyBytes?: number, parseBody?: boolean}} [options]
 */
export function createApiHandler(routeName, handler, options = {}) {
  const {
    rateLimit = { limit: 20, windowMs: 60_000 },
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
    parseBody = true,
  } = options;

  return async function wrappedHandler(request) {
    try {
      const user = await requireAuth(request);

      const { ok, retryAfterSeconds } = checkRateLimit(`${routeName}:${user.uid}`, rateLimit);
      if (!ok) {
        return NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
        );
      }

      let body = null;
      if (parseBody) {
        body = await readJsonBody(request, maxBodyBytes);
      }

      return await handler({ request, user, body });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // Never surface internal error details to the client.
      console.error(`[api:${routeName}]`, err);
      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.' },
        { status: 500 }
      );
    }
  };
}

async function readJsonBody(request, maxBodyBytes) {
  let raw;
  try {
    raw = await request.text();
  } catch {
    throw new ApiError('Unable to read request body', 400);
  }

  if (raw && Buffer.byteLength(raw, 'utf8') > maxBodyBytes) {
    throw new ApiError('Request body too large', 413);
  }

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError('Request body must be valid JSON', 400);
  }
}

/** Assert helper for request validation inside handlers. */
export function badRequest(message) {
  return new ApiError(message, 400);
}
