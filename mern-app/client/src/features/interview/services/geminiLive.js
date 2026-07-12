import { GoogleGenAI } from '@google/genai';
import { api } from '../../../lib/axios';

/**
 * Creates a Gemini client for the browser Live API connection.
 *
 * The permanent API key lives only on the server; the browser receives a
 * single-use, short-lived ephemeral token minted by /api/v1/ai/gemini-live-token.
 */
export async function createLiveClient() {
  const res = await api.post('/ai/gemini-live-token');
  const { token } = res.data.data;
  return new GoogleGenAI({
    apiKey: token,
    httpOptions: { apiVersion: 'v1alpha' },
  });
}
