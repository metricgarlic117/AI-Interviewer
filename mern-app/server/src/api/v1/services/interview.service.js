import Interview from '../../../models/Interview.js';
import User from '../../../models/User.js';
import ApiError from '../../../utils/ApiError.js';
import * as aiService from './ai.service.js';

const MAX_MESSAGES = 300;

export async function create(userId, config) {
  const interview = await Interview.create({ user: userId, config });
  return interview.toJSON();
}

export async function listForUser(userId, { limit = 20 } = {}) {
  const interviews = await Interview.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 50))
    .select('-messages -interviewerPersona');
  return interviews.map((i) => i.toJSON());
}

async function findOwned(userId, interviewId) {
  const interview = await Interview.findOne({ _id: interviewId, user: userId });
  if (!interview) {
    throw ApiError.notFound('Interview not found');
  }
  return interview;
}

export async function getById(userId, interviewId) {
  const interview = await findOwned(userId, interviewId);
  return interview.toJSON();
}

/** Stores the generated interviewer persona (system prompt) once. */
export async function setPersona(userId, interviewId, persona) {
  const interview = await findOwned(userId, interviewId);
  interview.interviewerPersona = persona;
  await interview.save();
  return interview.toJSON();
}

export async function addMessage(userId, interviewId, message) {
  const interview = await findOwned(userId, interviewId);
  if (interview.messages.length >= MAX_MESSAGES) {
    throw ApiError.badRequest('Transcript limit reached for this interview');
  }
  interview.messages.push({
    role: message.role,
    text: message.text,
    timestamp: message.timestamp || Date.now(),
  });
  await interview.save();
  return { count: interview.messages.length };
}

/**
 * Generates the scorecard for a finished interview, marks it completed, and
 * refreshes the user's dashboard recommendation from the results.
 */
export async function generateFeedback(userId, interviewId, clientMessages) {
  const interview = await findOwned(userId, interviewId);

  // Prefer the transcript the client just finished with (it may include
  // final turns still in flight to the messages endpoint), falling back to
  // what we have stored.
  const transcript =
    Array.isArray(clientMessages) && clientMessages.length > 0
      ? clientMessages
      : interview.messages;

  if (!transcript || transcript.length === 0) {
    throw ApiError.badRequest('No conversation recorded. Cannot generate feedback.');
  }

  const feedback = await aiService.generateInterviewFeedback({
    transcript,
    config: interview.config,
    resumeText: interview.config.resumeText,
    jobDescription: interview.config.jobDescription,
  });

  interview.feedback = feedback;
  interview.status = 'completed';
  interview.completedAt = new Date();
  if (Array.isArray(clientMessages) && clientMessages.length > interview.messages.length) {
    interview.messages = clientMessages.slice(0, MAX_MESSAGES);
  }
  await interview.save();

  // Surface the weakest area as the next recommended step.
  if (feedback.performanceScore < 70 && feedback.weaknesses?.length > 0) {
    await User.updateOne(
      { _id: userId },
      {
        recommendation: {
          type: 'review_weakness',
          message: `Focus on improving: ${feedback.weaknesses[0]}`,
          reason: `Your recent ${interview.config.role} interview showed this as an area for growth.`,
          targetAction: '/setup',
          createdAt: Date.now(),
        },
      }
    );
  }

  return feedback;
}
