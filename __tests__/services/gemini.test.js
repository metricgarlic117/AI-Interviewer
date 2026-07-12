/**
 * White Box Unit Tests: services/gemini.js
 * All external calls are mocked. authedFetch is mocked to delegate to
 * global.fetch so the existing fetch-mock helpers keep working.
 */

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../services/apiClient", () => ({
  authedFetch: jest.fn((url, options) => global.fetch(url, options)),
}));

import { GoogleGenAI } from "@google/genai";
import {
  createLiveClient,
  extractTextFromImage,
  generateInterviewFeedback,
  generateInterviewerPersona,
  analyzeResume,
} from "../../services/gemini";

function mockFetch(data, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(data),
  });
}

describe("createLiveClient", () => {
  afterEach(() => jest.clearAllMocks());

  it("exchanges an ephemeral token and constructs the client with it", async () => {
    mockFetch({ token: "ephemeral-token-123" });

    await createLiveClient();

    expect(fetch).toHaveBeenCalledWith(
      "/api/gemini-live-token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: "ephemeral-token-123",
      httpOptions: { apiVersion: "v1alpha" },
    });
  });

  it("throws with the server error message when the token request fails", async () => {
    mockFetch({ error: "Too many requests. Please slow down." }, false);
    await expect(createLiveClient()).rejects.toThrow(
      "Too many requests. Please slow down.",
    );
  });

  it("throws a generic message when the failure response has no body", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockRejectedValue(new Error("empty")),
    });
    await expect(createLiveClient()).rejects.toThrow(
      "Failed to start live session",
    );
  });
});

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
    await extractTextFromImage("myBase64", "image/png");
    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body).toEqual({ base64Image: "myBase64", mimeType: "image/png" });
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
    const body = JSON.parse(fetch.mock.calls[0][1].body);
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
    techStack: "React, JavaScript",
    questionCount: 10,
  };

  it("includes the role and level in the prompt", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).toContain("Frontend Developer");
    expect(prompt).toContain("Senior");
  });

  it("includes the tech stack in the prompt", async () => {
    const prompt = await generateInterviewerPersona(baseConfig);
    expect(prompt).toContain("React, JavaScript");
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
    const body = JSON.parse(fetch.mock.calls[0][1].body);
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
