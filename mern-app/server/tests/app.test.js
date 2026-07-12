/**
 * Boot-level tests using node:test — no external test dependencies.
 * Mongo/Redis are NOT required: these tests exercise the HTTP layer only
 * (health check, 404 envelope, validation envelope short-circuits before
 * any datastore access... except where a limiter fails open).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Provide the env contract before the config module loads.
process.env.MONGO_URI ||= 'mongodb://localhost:27017/test';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.ACCESS_TOKEN_SECRET ||= 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret';

const { default: app } = await import('../src/app.js');
const { ttlToSeconds } = await import('../src/api/v1/services/auth.service.js');
const { default: ApiError } = await import('../src/utils/ApiError.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('GET /health returns ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('unknown routes return the standard error envelope', async () => {
  const res = await fetch(`${baseUrl}/api/v1/nope`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Route not found/);
});

test('protected route without a token returns 401 envelope', async () => {
  const res = await fetch(`${baseUrl}/api/v1/users/me`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
});

test('ttlToSeconds parses supported units', () => {
  assert.equal(ttlToSeconds('15m'), 900);
  assert.equal(ttlToSeconds('7d'), 604800);
  assert.equal(ttlToSeconds('30s'), 30);
  assert.throws(() => ttlToSeconds('nope'));
});

test('ApiError statics carry the right status codes', () => {
  assert.equal(ApiError.badRequest('x').statusCode, 400);
  assert.equal(ApiError.unauthorized().statusCode, 401);
  assert.equal(ApiError.forbidden().statusCode, 403);
  assert.equal(ApiError.notFound().statusCode, 404);
  assert.equal(ApiError.conflict('x').statusCode, 409);
  assert.equal(ApiError.unprocessable('x').statusCode, 422);
  assert.equal(ApiError.tooManyRequests().statusCode, 429);
});
