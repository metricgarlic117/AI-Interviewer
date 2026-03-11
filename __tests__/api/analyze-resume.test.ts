/**
 * @jest-environment node
 *
 * White Box Unit Tests: app/api/analyze-resume/route.ts
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

import { POST } from '../../app/api/analyze-resume/route';

function makeRequest(body: object) {
    return { json: async () => body };
}

describe('POST /api/analyze-resume', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns 400 when resumeText is missing', async () => {
        const res = await POST(makeRequest({ jobDescription: 'Something' }) as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Resume text is required');
    });

    it('returns 400 when body is empty', async () => {
        const res = await POST(makeRequest({}) as any);
        expect(res.status).toBe(400);
    });

    it('returns parsed JSON analysis on success', async () => {
        const mockAnalysis = {
            matchScore: 80,
            roleFitSummary: 'Good fit',
            seniorityAlignment: 'Senior',
            skillsGap: { matchingSkills: ['React'], missingSkills: ['Docker'] },
            improvementSuggestions: ['Add Docker experience'],
            interviewFocusAreas: ['React performance'],
        };
        mockGenerateContent.mockResolvedValue({
            text: `Here is the analysis: ${JSON.stringify(mockAnalysis)}`,
        });

        const res = await POST(makeRequest({ resumeText: 'My resume content' }) as any);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.matchScore).toBe(80);
        expect(data.roleFitSummary).toBe('Good fit');
    });

    it('returns 500 when AI response contains no JSON', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'Unable to process' });
        const res = await POST(makeRequest({ resumeText: 'My resume' }) as any);
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('Failed to parse resume analysis');
    });

    it('returns 500 when Gemini throws', async () => {
        mockGenerateContent.mockRejectedValue(new Error('Rate limit exceeded'));
        const res = await POST(makeRequest({ resumeText: 'My resume' }) as any);
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('Rate limit exceeded');
    });

    it('includes jobDescription in prompt when provided', async () => {
        mockGenerateContent.mockResolvedValue({ text: '{"matchScore": 70}' });
        await POST(makeRequest({ resumeText: 'My resume', jobDescription: 'Work at Google' }) as any);

        const callArg = mockGenerateContent.mock.calls[0][0];
        expect(callArg.contents).toContain('Work at Google');
        expect(callArg.contents).toContain('against the job description');
    });

    it('does not mention job description in prompt when not provided', async () => {
        mockGenerateContent.mockResolvedValue({ text: '{"matchScore": 50}' });
        await POST(makeRequest({ resumeText: 'My resume' }) as any);

        const callArg = mockGenerateContent.mock.calls[0][0];
        expect(callArg.contents).not.toContain('against the job description');
    });
});
