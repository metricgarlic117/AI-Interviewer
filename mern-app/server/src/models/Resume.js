import mongoose from 'mongoose';

/**
 * A user's uploaded resume plus (optionally) the job description it was
 * analyzed against and the resulting analysis. The most recent document
 * per user is what the dashboard / analyzer surface as "latest".
 */
const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileName: { type: String, default: 'Uploaded Resume', maxlength: 255 },
    text: { type: String, required: true, maxlength: 30000 },
    jobDescription: { type: String, default: '', maxlength: 15000 },
    analysis: { type: mongoose.Schema.Types.Mixed, default: null },
    analyzedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

resumeSchema.index({ user: 1, createdAt: -1 });

const Resume = mongoose.model('Resume', resumeSchema);
export default Resume;
