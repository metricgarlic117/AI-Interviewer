/**
 * @jest-environment node
 *
 * White Box Unit Tests: app/api/extract-text/route.js
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

import { POST } from "../../app/api/extract-text/route";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { makeRequest } from "../helpers";

describe("POST /api/extract-text", () => {
  beforeAll(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  beforeEach(() => resetRateLimits());
  afterEach(() => jest.clearAllMocks());

  it("returns 401 when no Authorization header is sent", async () => {
    const res = await POST(
      makeRequest(
        { base64Image: "abc", mimeType: "image/png" },
        { authorization: null },
      ),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when base64Image is missing", async () => {
    const res = await POST(makeRequest({ mimeType: "image/png" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Image data and mime type are required");
  });

  it("returns 400 when mimeType is missing", async () => {
    const res = await POST(makeRequest({ base64Image: "abc123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Image data and mime type are required");
  });

  it("returns 400 when both fields are missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unsupported mime type", async () => {
    const res = await POST(
      makeRequest({ base64Image: "abc", mimeType: "application/pdf" }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unsupported image type");
  });

  it("returns extracted text on success", async () => {
    mockGenerateContent.mockResolvedValue({ text: "Extracted resume text" });
    const res = await POST(
      makeRequest({ base64Image: "base64content", mimeType: "image/jpeg" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("Extracted resume text");
  });

  it("returns empty string when AI returns no text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });
    const res = await POST(
      makeRequest({ base64Image: "abc", mimeType: "image/png" }),
    );
    const data = await res.json();
    expect(data.text).toBe("");
  });

  it("returns a generic 500 when Gemini throws an error", async () => {
    mockGenerateContent.mockRejectedValue(new Error("AI model unavailable"));
    const res = await POST(
      makeRequest({ base64Image: "abc", mimeType: "image/png" }),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("An unexpected error occurred. Please try again.");
  });

  it("sends image data in the correct format to Gemini", async () => {
    mockGenerateContent.mockResolvedValue({ text: "text" });
    await POST(
      makeRequest({ base64Image: "myImageData", mimeType: "image/png" }),
    );

    const callArg = mockGenerateContent.mock.calls[0][0];
    const parts = callArg.contents[0].parts;
    const inlinePart = parts.find((p) => p.inlineData);
    expect(inlinePart.inlineData.data).toBe("myImageData");
    expect(inlinePart.inlineData.mimeType).toBe("image/png");
  });
});
