/**
 * @jest-environment node
 *
 * White Box Unit Tests: app/api/generate-feedback/route.ts
 * This is the most complex route — tests all business logic branches.
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

import { POST } from '../../app/api/generate-feedback/route';

// Sample valid config
const sampleConfig = {
    role: 'Frontend Developer',
    level: 'Senior',
    type: 'Technical',
    mode: 'Realistic Interview',
};

const sampleTranscript = [
    { role: 'model', text: 'Tell me about yourself.' },
    { role: 'user', text: 'I have 5 years of React experience.' },
];

function makeRequest(body: object) {
    return { json: async () => body };
}

// Default mock AI response with full feedback
const fullFeedback = {
    performanceScore: 78,
    overallGrade: 'B',
    hiringDecision: 'Hire',
    hiringRationale: 'Solid candidate.',
    categoryScores: {
        technicalKnowledge: 8,
        problemSolving: 7,
        communicationClarity: 8,
        culturalAndBehavioral: 7,
        cvAlignment: 6,
    },
    communicationSkills: 'Clear.',
    technicalAccuracy: 'Good.',
    cvAlignmentFeedback: 'Claims match demonstrated knowledge.',
    jdAlignmentFeedback: 'Meets most requirements.',
    strengths: ['React expertise'],
    weaknesses: ['Limited cloud'],
    improvementTips: ['Study AWS'],
    perQuestionFeedback: [],
};

describe('POST /api/generate-feedback', () => {
    afterEach(() => jest.clearAllMocks());

    // --- Validation ---
    it('returns 400 when transcript is missing', async () => {
        const res = await POST(makeRequest({ config: sampleConfig }) as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Transcript and config are required');
    });

    it('returns 400 when config is missing', async () => {
        const res = await POST(makeRequest({ transcript: sampleTranscript }) as any);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('Transcript and config are required');
    });

    it('returns 400 when both are missing', async () => {
        const res = await POST(makeRequest({}) as any);
        expect(res.status).toBe(400);
    });

    // --- Happy path ---
    it('returns parsed feedback JSON on success', async () => {
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(fullFeedback) });

        const res = await POST(makeRequest({
            transcript: sampleTranscript,
            config: sampleConfig,
            resumeText: 'My detailed resume'.repeat(10),
            jobDescription: 'Looking for a developer'.repeat(5),
        }) as any);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.performanceScore).toBe(78);
        expect(data.overallGrade).toBe('B');
        expect(data.hiringDecision).toBe('Hire');
    });

    // --- No resume branch ---
    it('overrides cvAlignment to 0 when no resumeText is provided', async () => {
        const f = { ...fullFeedback, categoryScores: { ...fullFeedback.categoryScores, cvAlignment: 9 } };
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });

        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        const data = await res.json();

        expect(data.categoryScores.cvAlignment).toBe(0);
        expect(data.cvAlignmentFeedback).toContain('No CV/resume was provided');
    });

    it('overrides cvAlignment to 0 when resumeText is too short', async () => {
        const f = { ...fullFeedback, categoryScores: { ...fullFeedback.categoryScores, cvAlignment: 9 } };
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });

        const res = await POST(makeRequest({
            transcript: sampleTranscript,
            config: sampleConfig,
            resumeText: 'Short',
        }) as any);
        const data = await res.json();
        expect(data.categoryScores.cvAlignment).toBe(0);
    });

    // --- Missing field defaults ---
    it('auto-generates categoryScores when missing from AI response', async () => {
        const f = { ...fullFeedback, performanceScore: 70 };
        delete (f as any).categoryScores;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });

        // Provide a long resumeText so hasResume=true; otherwise the !hasResume branch
        // sets categoryScores before the missing-field default check runs.
        const res = await POST(makeRequest({
            transcript: sampleTranscript,
            config: sampleConfig,
            resumeText: 'My detailed resume content with lots of information about my experience.'.repeat(5),
        }) as any);
        const data = await res.json();
        expect(data.categoryScores).toBeDefined();
        expect(data.categoryScores.technicalKnowledge).toBeDefined();
    });

    it('auto-generates overallGrade A for score >= 90', async () => {
        const f = { ...fullFeedback, performanceScore: 92 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('A');
    });

    it('auto-generates overallGrade A- for score 85-89', async () => {
        const f = { ...fullFeedback, performanceScore: 86 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('A-');
    });

    it('auto-generates overallGrade B+ for score 80-84', async () => {
        const f = { ...fullFeedback, performanceScore: 82 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('B+');
    });

    it('auto-generates overallGrade B for score 75-79', async () => {
        const f = { ...fullFeedback, performanceScore: 76 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('B');
    });

    it('auto-generates overallGrade B- for score 70-74', async () => {
        const f = { ...fullFeedback, performanceScore: 72 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('B-');
    });

    it('auto-generates overallGrade C+ for score 65-69', async () => {
        const f = { ...fullFeedback, performanceScore: 67 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('C+');
    });

    it('auto-generates overallGrade C for score 60-64', async () => {
        const f = { ...fullFeedback, performanceScore: 62 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('C');
    });

    it('auto-generates overallGrade C- for score 55-59', async () => {
        const f = { ...fullFeedback, performanceScore: 57 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('C-');
    });

    it('auto-generates overallGrade D for score below 55', async () => {
        const f = { ...fullFeedback, performanceScore: 40 };
        delete (f as any).overallGrade;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).overallGrade).toBe('D');
    });

    // --- hiringDecision defaults ---
    it('auto-generates hiringDecision Strong Hire for score >= 85', async () => {
        const f = { ...fullFeedback, performanceScore: 88 };
        delete (f as any).hiringDecision;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });

        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).hiringDecision).toBe('Strong Hire');
    });

    it('auto-generates hiringDecision Hire for score 70-84', async () => {
        const f = { ...fullFeedback, performanceScore: 75 };
        delete (f as any).hiringDecision;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });

        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).hiringDecision).toBe('Hire');
    });

    it('auto-generates hiringDecision Borderline for score 55-69', async () => {
        const f = { ...fullFeedback, performanceScore: 60 };
        delete (f as any).hiringDecision;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });

        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).hiringDecision).toBe('Borderline');
    });

    it('auto-generates hiringDecision No Hire for score < 55', async () => {
        const f = { ...fullFeedback, performanceScore: 40 };
        delete (f as any).hiringDecision;
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(f) });

        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect((await res.json()).hiringDecision).toBe('No Hire');
    });

    // --- Transcript filtering ---
    it('filters out "Start the interview now." from the transcript', async () => {
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(fullFeedback) });
        const noisyTranscript = [
            { role: 'user', text: 'Start the interview now.' },
            { role: 'model', text: 'Tell me about yourself.' },
        ];

        await POST(makeRequest({ transcript: noisyTranscript, config: sampleConfig }) as any);

        const promptUsed = mockGenerateContent.mock.calls[0][0].contents;
        expect(promptUsed).not.toContain('Start the interview now.');
        expect(promptUsed).toContain('Tell me about yourself.');
    });

    // --- Error cases ---
    it('returns 500 when AI response has no JSON object', async () => {
        mockGenerateContent.mockResolvedValue({ text: 'No JSON here' });
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect(res.status).toBe(500);
    });

    it('returns 500 when Gemini throws an error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('AI overloaded'));
        const res = await POST(makeRequest({ transcript: sampleTranscript, config: sampleConfig }) as any);
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('AI overloaded');
    });
});
