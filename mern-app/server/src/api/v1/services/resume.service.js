import Resume from '../../../models/Resume.js';
import User from '../../../models/User.js';
import * as aiService from './ai.service.js';

/**
 * Runs the Gemini analysis, persists the resume + analysis, and updates the
 * user's prep context so the dashboard and setup page can personalize.
 */
export async function analyzeAndSave(userId, { text, fileName, jobDescription }) {
  const analysis = await aiService.analyzeResume(text, jobDescription);

  const resume = await Resume.create({
    user: userId,
    fileName: fileName || 'Uploaded Resume',
    text,
    jobDescription: jobDescription || '',
    analysis,
    analyzedAt: new Date(),
  });

  await User.updateOne(
    { _id: userId },
    {
      prepContext: {
        targetRole: analysis.roleFitSummary?.split(' ')[0] || 'Software Engineer',
        seniorityLevel: analysis.seniorityAlignment || 'Junior',
        lastUpdated: Date.now(),
      },
    }
  );

  return { resume: resume.toJSON(), analysis };
}

export async function getLatest(userId) {
  const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
  return resume ? resume.toJSON() : null;
}
