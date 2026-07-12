import { NextResponse } from 'next/server';
import { createApiHandler } from '@/lib/server/api-handler';

const TOKEN_TTL_SECONDS = 600;

/**
 * Issues a short-lived AssemblyAI realtime token.
 *
 * The permanent ASSEMBLYAI_API_KEY never leaves the server — the client only
 * ever sees a temporary token scoped to a single streaming session.
 */
export const POST = createApiHandler(
  'assemblyai-token',
  async () => {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      console.error('[assemblyai-token] ASSEMBLYAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Transcription service is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expires_in: TOKEN_TTL_SECONDS }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[assemblyai-token] Token request failed:', response.status, detail);
      return NextResponse.json(
        { error: 'Failed to create transcription session' },
        { status: 502 }
      );
    }

    const { token } = await response.json();
    return NextResponse.json({ token });
  },
  {
    rateLimit: { limit: 10, windowMs: 60_000 },
    parseBody: false,
  }
);
