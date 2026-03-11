/**
 * @jest-environment node
 *
 * White Box Unit Tests: app/api/extract-text/route.ts
 * Mocks next/server and @google/genai to avoid runtime dependencies.
 */

// Mock next/server before importing the route
jest.mock('next/server', () => ({
    NextRequest: class MockNextRequest { },
    NextResponse: {
        json: (data, init) => ({
            status: (init && init.status) || 200,
            json: async () => data,
        }),
    },
}));

// Mock @google/genai
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
    })),
}));

import { POST } from '../../app/api/extract-text/route';

function makeRequest(body: object) {
    return { json: async () => body };
}

describe('POST /api/extract-text', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns 400 when base64Image is missing', async () => {
        const res = await POST(makeRequest({ mimeType: 'image/png' }) as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Image data and mime type are required');
    });

    it('returns 400 when mimeType is missing', async () => {
        const res = await POST(makeRequest({ base64Image: 'abc123' }) as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Image data and mime type are required');
    });

    it('returns 400 when both fields are missing', async () => {
        const res = await POST(makeRequest({}) as any);
        expect(res.status).toBe(400);
    });

    it('returns extracted text on success', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'Extracted resume text' });
        const res = await POST(makeRequest({ base64Image: 'base64content', mimeType: 'image/jpeg' }) as any);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.text).toBe('Extracted resume text');
    });

    it('returns empty string when AI returns no text', async () => {
        mockGenerateContent.mockResolvedValue({ text: '' });
        const res = await POST(makeRequest({ base64Image: 'abc', mimeType: 'image/png' }) as any);
        const data = await res.json();
        expect(data.text).toBe('');
    });

    it('returns 500 when Gemini throws an error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('AI model unavailable'));
        const res = await POST(makeRequest({ base64Image: 'abc', mimeType: 'image/png' }) as any);
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('AI model unavailable');
    });

    it('sends image data in the correct format to Gemini', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'text' });
        await POST(makeRequest({ base64Image: 'myImageData', mimeType: 'image/pdf' }) as any);

        const callArg = mockGenerateContent.mock.calls[0][0];
        const parts = callArg.contents[0].parts;
        const inlinePart = parts.find((p: any) => p.inlineData);
        expect(inlinePart.inlineData.data).toBe('myImageData');
        expect(inlinePart.inlineData.mimeType).toBe('image/pdf');
    });
});
