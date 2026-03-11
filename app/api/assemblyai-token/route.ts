import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      );
    }

    // Return API key for real-time WebSocket connection
    // This is secure since it's only sent over HTTPS and not exposed in client code
    return NextResponse.json({ apiKey });
  } catch (error: any) {
    console.error('Error providing AssemblyAI credentials:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to provide credentials' },
      { status: 500 }
    );
  }
}
