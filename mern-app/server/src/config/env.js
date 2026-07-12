import 'dotenv/config';

/**
 * Validated environment. Imported first by server.js so a misconfigured
 * deployment crashes at boot with a clear message instead of failing at
 * request time.
 */

const REQUIRED = [
  'MONGO_URI',
  'REDIS_URL',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `[env] Missing required environment variables: ${missing.join(', ')}.\n` +
      '[env] Copy server/.env.example to server/.env and fill in every value.'
  );
  process.exit(1);
}

if (process.env.ACCESS_TOKEN_SECRET === process.env.REFRESH_TOKEN_SECRET) {
  // eslint-disable-next-line no-console
  console.error('[env] ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must differ.');
  process.exit(1);
}

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  PORT: Number.parseInt(process.env.PORT || '5000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '15m',
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL || '7d',
});

if (Number.isNaN(env.PORT)) {
  // eslint-disable-next-line no-console
  console.error('[env] PORT must be a number.');
  process.exit(1);
}

export default env;
