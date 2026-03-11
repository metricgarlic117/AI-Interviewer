/**
 * @jest-environment node
 *
 * White Box Unit Tests: app/api/assemblyai-token/route.ts
 * Tests the API route handler by mocking the request object directly.
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

import { POST } from '../../app/api/assemblyai-token/route';

// Simple mock request factory — the handler only reads process.env, not the request body
function makeRequest() {
    return { json: async () => ({}) };
}

describe('POST /api/assemblyai-token', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns the API key when ASSEMBLYAI_API_KEY env var is set', async () => {
        process.env.ASSEMBLYAI_API_KEY = 'test-asm-key-12345';

        const response = await POST(makeRequest() as any);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.apiKey).toBe('test-asm-key-12345');
    });

    it('returns 500 with error when ASSEMBLYAI_API_KEY is not set', async () => {
        delete process.env.ASSEMBLYAI_API_KEY;

        const response = await POST(makeRequest() as any);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('AssemblyAI API key not configured');
    });

    it('response contains apiKey field when key is configured', async () => {
        process.env.ASSEMBLYAI_API_KEY = 'abc-key';
        const response = await POST(makeRequest() as any);
        expect(response).toBeDefined();
        const data = await response.json();
        expect(data).toHaveProperty('apiKey');
    });
});
