import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { ROLES, BCRYPT_SALT_ROUNDS } from '../constants/index.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // never returned unless explicitly requested
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // Career-prep context derived from resume analyses; drives the
    // personalized dashboard greeting and setup prefills.
    prepContext: {
      targetRole: { type: String, default: null },
      seniorityLevel: { type: String, default: null },
      lastUpdated: { type: Number, default: null },
    },
    // Current "recommended next step" card shown on the dashboard.
    recommendation: {
      type: {
        type: String,
        enum: ['analyze_resume', 'practice_interview', 'review_weakness', null],
        default: null,
      },
      message: { type: String, default: null },
      reason: { type: String, default: null },
      targetAction: { type: String, default: null },
      createdAt: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
