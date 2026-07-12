/**
 * @jest-environment node
 *
 * White Box Unit Tests: app/api/assemblyai-token/route.js
 * The route exchanges the server-side API key for a short-lived realtime
 * token — the permanent key must never appear in the response.
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

import { POST } from "../../app/api/assemblyai-token/route";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { makeRequest } from "../helpers";

describe("POST /api/assemblyai-token", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetRateLimits();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header is sent", async () => {
    const res = await POST(makeRequest(undefined, { authorization: null }));
    expect(res.status).toBe(401);
  });

  it("returns a temporary token, never the permanent API key", async () => {
    process.env.ASSEMBLYAI_API_KEY = "permanent-secret-key";
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: "temp-realtime-token" }),
    });

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.token).toBe("temp-realtime-token");
    expect(JSON.stringify(data)).not.toContain("permanent-secret-key");
  });

  it("requests the token from AssemblyAI with the server-side key", async () => {
    process.env.ASSEMBLYAI_API_KEY = "server-key";
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: "tok" }),
    });

    await POST(makeRequest());

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.assemblyai.com/v2/realtime/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "server-key" }),
      }),
    );
  });

  it("returns 500 when ASSEMBLYAI_API_KEY is not set", async () => {
    delete process.env.ASSEMBLYAI_API_KEY;

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Transcription service is not configured");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 502 when AssemblyAI rejects the token request", async () => {
    process.env.ASSEMBLYAI_API_KEY = "server-key";
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "bad key",
    });

    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toBe("Failed to create transcription session");
  });
});
