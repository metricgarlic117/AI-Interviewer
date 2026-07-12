import { api } from '../../../lib/axios';

export async function createInterview(config) {
  const res = await api.post('/interviews', { config });
  return res.data.data.interview;
}

export async function listInterviews(limit = 20) {
  const res = await api.get('/interviews', { params: { limit } });
  return res.data.data.interviews;
}

export async function getInterview(id) {
  const res = await api.get(`/interviews/${id}`);
  return res.data.data.interview;
}

export async function savePersona(id, interviewerPersona) {
  const res = await api.patch(`/interviews/${id}/persona`, { interviewerPersona });
  return res.data.data.interview;
}

/** Fire-and-forget transcript persistence during a live session. */
export async function saveMessage(id, message) {
  try {
    await api.post(`/interviews/${id}/messages`, message);
  } catch (error) {
    // Non-blocking: a dropped message shouldn't interrupt the interview.
    console.error('Error saving message:', error);
  }
}

export async function generateFeedback(id, messages) {
  const res = await api.post(`/interviews/${id}/feedback`, { messages });
  return res.data.data.feedback;
}
