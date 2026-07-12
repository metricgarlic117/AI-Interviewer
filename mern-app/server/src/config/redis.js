import { createClient } from 'redis';
import env from './env.js';
import logger from '../utils/logger.js';

/**
 * Single shared Redis client. Connection is established explicitly in
 * server.js (connectRedis) so importing this module — e.g. from tests —
 * never opens a socket by itself.
 */
export const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on('error', (err) => {
  logger.error('[redis] client error', err);
});

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    logger.info('[redis] connected');
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}
