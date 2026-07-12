/**
 * @jest-environment node
 *
 * White Box Unit Tests: app/api/analyze-resume/route.js
 * Mocks next/server, the auth layer, and @google/genai.
 */

// Mock next/server before importing the route
jest.mock("next/server", () => ({
  NextRequest: class MockNextRequest {},
  NextResponse: {
    json: (data, init) => ({
      status: (init && init.status) || 200,
      json: async () => data,
    }),
  },
}));

// Accept any Bearer token without hitting firebase-admin
jest.mock("@/lib/server/auth", () => {
  const { fakeAuthModule } = require("../helpers");
  return fakeAuthModule();
});

// Mock @google/genai
const mockGenerateContent = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

import { POST } from "../../app/api/analyze-resume/route";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { makeRequest } from "../helpers";

describe("POST /api/analyze-resume", () => {
  beforeAll(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  beforeEach(() => resetRateLimits());
  afterEach(() => jest.clearAllMocks());

  it("returns 401 when no Authorization header is sent", async () => {
    const res = await POST(
      makeRequest({ resumeText: "My resume" }, { authorization: null }),
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Authentication required");
  });

  it("returns 400 when resumeText is missing", async () => {
    const res = await POST(makeRequest({ jobDescription: "Something" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Resume text is required");
  });

  it("returns 400 when body is empty", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when resumeText is not a string", async () => {
    const res = await POST(makeRequest({ resumeText: 12345 }));
    expect(res.status).toBe(400);
  });

  it("returns 413 when the body exceeds the size limit", async () => {
    const res = await POST(
      makeRequest({ resumeText: "x".repeat(600 * 1024) }),
    );
    expect(res.status).toBe(413);
  });

  it("returns 429 after exceeding the rate limit", async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"matchScore": 70}' });

    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await POST(makeRequest({ resumeText: "My resume" }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("returns parsed JSON analysis on success", async () => {
    const mockAnalysis = {
      matchScore: 80,
      roleFitSummary: "Good fit",
      seniorityAlignment: "Senior",
      skillsGap: { matchingSkills: ["React"], missingSkills: ["Docker"] },
      improvementSuggestions: ["Add Docker experience"],
      interviewFocusAreas: ["React performance"],
    };
    mockGenerateContent.mockResolvedValue({
      text: `Here is the analysis: ${JSON.stringify(mockAnalysis)}`,
    });

    const res = await POST(makeRequest({ resumeText: "My resume content" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.matchScore).toBe(80);
    expect(data.roleFitSummary).toBe("Good fit");
  });

  it("returns a generic 500 when AI response contains no JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "Unable to process" });
    const res = await POST(makeRequest({ resumeText: "My resume" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("An unexpected error occurred. Please try again.");
  });

  it("does not leak internal error details when Gemini throws", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(makeRequest({ resumeText: "My resume" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).not.toContain("Rate limit exceeded");
    expect(data.error).toBe("An unexpected error occurred. Please try again.");
  });

  it("includes jobDescription in prompt when provided", async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"matchScore": 70}' });
    await POST(
      makeRequest({
        resumeText: "My resume",
        jobDescription: "Work at Google",
      }),
    );

    const callArg = mockGenerateContent.mock.calls[0][0];
    expect(callArg.contents).toContain("Work at Google");
    expect(callArg.contents).toContain("against the job description");
  });

  it("does not mention job description in prompt when not provided", async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"matchScore": 50}' });
    await POST(makeRequest({ resumeText: "My resume" }));

    const callArg = mockGenerateContent.mock.calls[0][0];
    expect(callArg.contents).not.toContain("against the job description");
  });
});
