/**
 * Minimal structured logger with levels, no external dependency.
 * Swap the implementation for pino/winston without touching call sites —
 * the exported surface (error/warn/info/debug + stream) stays the same.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel =
  LEVELS[process.env.LOG_LEVEL] ??
  (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

function log(level, args) {
  if (LEVELS[level] > activeLevel) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}]`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](line, ...args);
}

const logger = {
  error: (...args) => log('error', args),
  warn: (...args) => log('warn', args),
  info: (...args) => log('info', args),
  debug: (...args) => log('debug', args),
  /** morgan-compatible write stream for HTTP access logs. */
  stream: {
    write: (message) => log('info', [message.trim()]),
  },
};

export default logger;
