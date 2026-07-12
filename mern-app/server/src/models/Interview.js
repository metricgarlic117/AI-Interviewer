import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true, maxlength: 8000 },
    timestamp: { type: Number, default: () => Date.now() },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    config: {
      role: { type: String, required: true, maxlength: 120 },
      type: { type: String, required: true },
      level: { type: String, required: true },
      mode: { type: String, required: true },
      techStack: { type: String, default: '', maxlength: 2000 },
      questionCount: { type: Number, min: 3, max: 10, default: 5 },
      jobDescription: { type: String, default: '', maxlength: 15000 },
      resumeText: { type: String, default: '', maxlength: 30000 },
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed'],
      default: 'in-progress',
      index: true,
    },
    messages: { type: [messageSchema], default: [] },
    feedback: { type: mongoose.Schema.Types.Mixed, default: null },
    interviewerPersona: { type: String, default: null, maxlength: 20000 },
    completedAt: { type: Date, default: null },
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

interviewSchema.index({ user: 1, createdAt: -1 });

const Interview = mongoose.model('Interview', interviewSchema);
export default Interview;
