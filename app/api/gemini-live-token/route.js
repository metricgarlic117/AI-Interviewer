import { NextResponse } from 'next/server';
import { createApiHandler } from '@/lib/server/api-handler';
import { geminiClient } from '@/lib/server/gemini-client';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000; // max session length
const CONNECT_WINDOW_MS = 2 * 60 * 1000; // time allowed to open the connection

/**
 * Issues a single-use ephemeral Gemini token for the browser Live API
 * connection, so the permanent GEMINI_API_KEY never reaches the client.
 */
export const POST = createApiHandler(
  'gemini-live-token',
  async () => {
    const now = Date.now();
    const token = await geminiClient().authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
        newSessionExpireTime: new Date(now + CONNECT_WINDOW_MS).toISOString(),
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return NextResponse.json({ token: token.name });
  },
  {
    rateLimit: { limit: 10, windowMs: 60_000 },
    parseBody: false,
  }
);
