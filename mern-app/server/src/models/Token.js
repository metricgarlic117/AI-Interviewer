import mongoose from 'mongoose';
import { TOKEN_TYPES } from '../constants/index.js';

/**
 * Durable record of every issued refresh token, keyed by its JWT ID (jti).
 *
 * Redis is the hot path (the whitelist consulted on every /auth/refresh);
 * this collection is the audit trail and recovery path: it powers
 * "log out everywhere" (revoke all of a user's sessions even if Redis was
 * flushed) and lets us detect refresh-token reuse.
 */
const tokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TOKEN_TYPES),
      default: TOKEN_TYPES.REFRESH,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByJti: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Mongo removes the document shortly after the token expires.
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Token = mongoose.model('Token', tokenSchema);
export default Token;
