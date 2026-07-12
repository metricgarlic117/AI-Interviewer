import { GoogleGenAI } from '@google/genai';

let cachedClient = null;

/**
 * Lazily constructed Gemini client so a missing key fails the request with a
 * clear log line instead of crashing the whole server at import time.
 */
export function geminiClient() {
  if (!cachedClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}
