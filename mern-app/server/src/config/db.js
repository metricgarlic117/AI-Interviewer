import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

export async function connectDb() {
  mongoose.connection.on('error', (err) => {
    logger.error('[mongo] connection error', err);
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('[mongo] disconnected');
  });

  await mongoose.connect(env.MONGO_URI);
  logger.info('[mongo] connected');
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
