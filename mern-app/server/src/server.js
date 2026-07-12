import env from './config/env.js'; // validates env — must be first
import app from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import logger from './utils/logger.js';

let server;

async function start() {
  await connectDb();
  await connectRedis();

  server = app.listen(env.PORT, () => {
    logger.info(`[server] listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

async function shutdown(signal) {
  logger.info(`[server] ${signal} received, shutting down gracefully`);
  const forceExit = setTimeout(() => {
    logger.error('[server] shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await disconnectRedis();
    await disconnectDb();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error('[server] error during shutdown', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('[server] unhandled promise rejection', reason);
  throw reason instanceof Error ? reason : new Error(String(reason));
});
process.on('uncaughtException', (err) => {
  logger.error('[server] uncaught exception', err);
  process.exit(1);
});

start().catch((err) => {
  logger.error('[server] failed to start', err);
  process.exit(1);
});
