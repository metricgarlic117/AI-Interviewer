/**
 * White Box Unit Tests: services/gemini.ts
 * All external fetch calls and GoogleGenAI are mocked.
 *
 * NOTE: jest.mock is hoisted, so we cannot reference variables declared
 * in the module scope. We use jest.fn() directly inside the factory.
 */

jest.mock("@google/genai", () => {
  const generateContentMock = jest.fn();
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: generateContentMock,
      },
    })),
    // Expose the mock so tests can access it via require()
    __mockGenerateContent: generateContentMock,
  };
});

const mockGenAIModule = require("@google/genai");
const mockGenerateContent: jest.Mock = mockGenAIModule.__mockGenerateContent;

import {
  extractTextFromImage,
  generateInterviewFeedback,
  generateInterviewerPersona,
  analyzeResume,
  generateInterview,
  evaluateAnswer,
} from "../../services/gemini";

function mockFetch(data: object, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(data),
  } as any);
}

describe("extractTextFromImage", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns text from a successful response", async () => {
    mockFetch({ text: "Hello World" });
    const result = await extractTextFromImage("base64data", "image/png");
    expect(result).toBe("Hello World");
    expect(fetch).toHaveBeenCalledWith(
      "/api/extract-text",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns empty string when response has no text field", async () => {
    mockFetch({});
    const result = await extractTextFromImage("base64data", "image/png");
    expect(result).toBe("");
  });

  it("throws an error when response is not ok", async () => {
    mockFetch({ error: "Server error" }, false);
    await expect(
      extractTextFromImage("base64data", "image/png"),
    ).rejects.toThrow("Server error");
  });

  it("throws when fetch itself rejects", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));
    await expect(extractTextFromImage("img", "image/jpeg")).rejects.toThrow(
      "Network failure",
    );
  });

  it("sends the correct request body", async () => {
    mockFetch({ text: "extracted" });
    await extractTextFromImage("myBase64", "image/pdf");
    const call = (fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body).toEqual({ base64Image: "myBase64", mimeType: "image/pdf" });
  });
});

describe("generateInterviewFeedback", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns parsed JSON on a successful response", async () => {
    const mockData = { performanceScore: 75, overallGrade: "B" };
    mockFetch(mockData);
    const result = await generateInterviewFeedback([], { role: "Engineer" });
    expect(result).toEqual(mockData);
  });

  it("throws when response is not ok", async () => {
    mockFetch({ error: "Transcript required" }, false);
    await expect(generateInterviewFeedback([], {})).rejects.toThrow(
      "Transcript required",
    );
  });

  it("sends transcript, config, resumeText, and jobDescription in body", async () => {
    mockFetch({ ok: true });
    const transcript = [{ role: "user", text: "Hello" }];
    const config = { role: "Engineer" };
    await generateInterviewFeedback(
      transcript,
      config,
      "My resume",
      "Job desc",
    );
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.transcript).toEqual(transcript);
    expect(body.config).toEqual(config);
    expect(body.resumeText).toBe("My resume");
    expect(body.jobDescription).toBe("Job desc");
  });
});

describe("generateInterviewerPersona", () => {
  const baseConfig = {
    role: "Frontend Developer",
    level: "Senior",
    mode: "Friendly Coach",
    techStack: "React, TypeScript",
    questionCount: 10,
  };

  it("includes the role and level in the prompt", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).toContain("Frontend Developer");
    expect(prompt).toContain("Senior");
  });

  it("includes the tech stack in the prompt", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).toContain("React, TypeScript");
  });

  it("includes the question count", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).toContain("10");
  });

  it("uses the correct mode instruction for Friendly Coach", async () => {
    const prompt = await generateInterviewerPersona({
      ...baseConfig,
      mode: "Friendly Coach",
    });
    expect(prompt).toContain("Friendly Coach");
    expect(prompt).toContain("Validation Score: High");
  });

  it("uses the correct mode instruction for Realistic Interview", async () => {
    const prompt = await generateInterviewerPersona({
      ...baseConfig,
      mode: "Realistic Interview",
    });
    expect(prompt).toContain("Corporate Interviewer");
    expect(prompt).toContain("Validation Score: Neutral");
  });

  it("uses the correct mode instruction for Stress Mode", async () => {
    const prompt = await generateInterviewerPersona({
      ...baseConfig,
      mode: "Stress Mode",
    });
    expect(prompt).toContain("Stress Interview");
    expect(prompt).toContain("Validation Score: Low/skeptical");
  });

  it("includes resume text when provided", async () => {
    const prompt = await generateInterviewerPersona({
      ...baseConfig,
      resumeText: "My resume content",
    });
    expect(prompt).toContain("My resume content");
  });

  it("includes job description when provided", async () => {
    const prompt = await generateInterviewerPersona({
      ...baseConfig,
      jobDescription: "Work at Acme Corp",
    });
    expect(prompt).toContain("Work at Acme Corp");
  });

  it("does not include CANDIDATE PROFILE section when no resumeText", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).not.toContain("CANDIDATE PROFILE");
  });

  it("does not include TARGET ROLE REQUIREMENTS section when no jobDescription", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).not.toContain("TARGET ROLE REQUIREMENTS");
  });

  it("contains ending instruction for the AI", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).toContain(
      "Thank you for your time. That concludes our interview.",
    );
  });
});

describe("analyzeResume", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns parsed analysis data on success", async () => {
    const mockAnalysis = { matchScore: 80 };
    mockFetch(mockAnalysis);
    const result = await analyzeResume("My resume text", "Job description");
    expect(result).toEqual(mockAnalysis);
  });

  it("works without a job description", async () => {
    mockFetch({ matchScore: 50 });
    const result = await analyzeResume("My resume text");
    expect(result).toEqual({ matchScore: 50 });
  });

  it("sends correct body to /api/analyze-resume", async () => {
    mockFetch({ ok: true });
    await analyzeResume("Resume text", "JD text");
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.resumeText).toBe("Resume text");
    expect(body.jobDescription).toBe("JD text");
  });

  it("throws when response is not ok", async () => {
    mockFetch({ error: "Resume text is required" }, false);
    await expect(analyzeResume("")).rejects.toThrow("Resume text is required");
  });

  it("throws when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused"));
    await expect(analyzeResume("text")).rejects.toThrow("Connection refused");
  });
});

describe("generateInterview", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns parsed JSON array from AI response", async () => {
    const mockQuestions = [
      {
        question: "What is closure?",
        topic: "JS",
        difficulty: "medium",
        hints: [],
      },
    ];
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(mockQuestions),
    });

    const result = await generateInterview(["JavaScript"], "medium");
    expect(result).toEqual(mockQuestions);
  });

  it("throws when AI response has no JSON array", async () => {
    mockGenerateContent.mockResolvedValue({ text: "No JSON here at all" });
    await expect(generateInterview(["Python"], "easy")).rejects.toThrow(
      "Failed to generate questions",
    );
  });

  it("throws when generateContent itself fails", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API quota exceeded"));
    await expect(generateInterview(["Java"], "hard")).rejects.toThrow(
      "API quota exceeded",
    );
  });

  it("passes topics and difficulty in the prompt", async () => {
    mockGenerateContent.mockResolvedValue({ text: "[]" });
    try {
      await generateInterview(["React", "TypeScript"], "hard");
    } catch {
      /* expected */
    }
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain("React");
    expect(callArgs.contents).toContain("TypeScript");
    expect(callArgs.contents).toContain("hard");
  });
});

describe("evaluateAnswer", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns parsed JSON feedback from AI response", async () => {
    const mockFeedback = {
      score: 85,
      feedback: "Great answer",
      suggestions: [],
    };
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(mockFeedback),
    });

    const result = await evaluateAnswer(
      "What is a closure?",
      "A closure is...",
    );
    expect(result).toEqual(mockFeedback);
  });

  it("throws when AI response has no JSON object", async () => {
    mockGenerateContent.mockResolvedValue({ text: "Cannot evaluate" });
    await expect(evaluateAnswer("Q", "A")).rejects.toThrow(
      "Failed to evaluate answer",
    );
  });

  it("throws when generateContent itself fails", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Model overloaded"));
    await expect(evaluateAnswer("Q", "A")).rejects.toThrow("Model overloaded");
  });

  it("passes question and answer in the prompt", async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"score": 70}' });
    await evaluateAnswer("What is React?", "React is a library");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain("What is React?");
    expect(callArgs.contents).toContain("React is a library");
  });
});
