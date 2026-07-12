import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import env from './config/env.js';
import logger from './utils/logger.js';
import v1Routes from './api/v1/routes/index.js';
import notFoundMiddleware from './middleware/notFound.middleware.js';
import errorMiddleware from './middleware/error.middleware.js';

/**
 * Builds and configures the Express app without listening — server.js owns
 * the process lifecycle; tests can import this app directly.
 */
const app = express();

app.disable('x-powered-by');
// Correct req.ip / secure cookies when running behind a reverse proxy.
app.set('trust proxy', 1);

app.use(morgan(env.IS_PRODUCTION ? 'combined' : 'dev', { stream: logger.stream }));
app.use(
  cors({
    origin: env.CLIENT_URL.split(',').map((origin) => origin.trim()),
    credentials: true,
  })
);
// Image OCR uploads need a larger body cap than everything else; this
// parser must be registered before the global 1mb one so it wins.
app.use('/api/v1/ai/extract-text', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/v1', v1Routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
