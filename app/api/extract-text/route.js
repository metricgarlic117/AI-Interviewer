import { NextResponse } from 'next/server';
import { createApiHandler, badRequest } from '@/lib/server/api-handler';
import { geminiClient } from '@/lib/server/gemini-client';

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
// ~6 MB of raw image once base64 overhead (~33%) is accounted for.
const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024;

export const POST = createApiHandler(
  'extract-text',
  async ({ body }) => {
    const { base64Image, mimeType } = body;

    if (!base64Image || typeof base64Image !== 'string' || !mimeType) {
      throw badRequest('Image data and mime type are required');
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw badRequest('Unsupported image type. Use PNG, JPEG, or WebP.');
    }
    if (base64Image.length > MAX_IMAGE_BASE64_CHARS) {
      throw badRequest('Image is too large. Maximum size is 6 MB.');
    }

    const prompt =
      'Extract all text from this image. Return only the text content, nothing else.';

    const result = await geminiClient().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
    });

    const text = result.text || '';
    return NextResponse.json({ text });
  },
  {
    rateLimit: { limit: 15, windowMs: 60_000 },
    maxBodyBytes: 12 * 1024 * 1024,
  }
);
