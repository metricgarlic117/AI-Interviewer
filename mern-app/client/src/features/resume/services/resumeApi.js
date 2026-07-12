import { api } from '../../../lib/axios';

/** Runs Gemini analysis server-side and persists resume + analysis. */
export async function analyzeResume({ text, fileName, jobDescription }) {
  const res = await api.post('/resumes/analyze', { text, fileName, jobDescription });
  return res.data.data; // { resume, analysis }
}

export async function getLatestResume() {
  const res = await api.get('/resumes/latest');
  return res.data.data.resume;
}

/** OCR for screenshots of job descriptions. */
export async function extractTextFromImage(base64Image, mimeType) {
  const res = await api.post('/ai/extract-text', { base64Image, mimeType });
  return res.data.data.text || '';
}
