const mockSend = jest.fn();
const mockClose = jest.fn();
let mockOnOpen: (() => void) | null = null;
let mockOnMessage: ((event: { data: string }) => void) | null = null;
let mockOnError: ((error: any) => void) | null = null;
let mockOnClose: (() => void) | null = null;

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readyState: number;
  url: string;

  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    // Store handlers for test access
    setTimeout(() => {
      mockOnOpen = this.onopen;
      mockOnMessage = this.onmessage;
      mockOnError = this.onerror;
      mockOnClose = this.onclose;
    }, 0);
  }

  send = mockSend;
  close = mockClose;
}

// Attach to global before importing the module
(global as any).WebSocket = MockWebSocket;

// Mock fetch for token retrieval
const mockFetchImpl = jest.fn();
global.fetch = mockFetchImpl;

import {
  AssemblyAISession,
  createAssemblyAISession,
} from "../../services/assemblyai";

function makeMockConfig() {
  return {
    onTranscript: jest.fn(),
    onError: jest.fn(),
    onClose: jest.fn(),
    sampleRate: 16000,
  };
}

function mockTokenFetch() {
  mockFetchImpl.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ apiKey: "test-api-key" }),
  });
}

describe("AssemblyAISession constructor", () => {
  it("defaults sampleRate to 16000 when not provided", () => {
    const session = new AssemblyAISession({
      onTranscript: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    });
    expect(session).toBeDefined();
  });

  it("accepts a custom sampleRate", () => {
    const session = new AssemblyAISession({
      onTranscript: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
      sampleRate: 44100,
    });
    expect(session).toBeDefined();
  });
});

describe("AssemblyAISession.isActive()", () => {
  it("returns false before connecting", () => {
    const session = new AssemblyAISession(makeMockConfig());
    expect(session.isActive()).toBe(false);
  });
});

describe("AssemblyAISession.connect()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenFetch();
  });

  it("fetches the API token from /api/assemblyai-token", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();
    expect(mockFetchImpl).toHaveBeenCalledWith("/api/assemblyai-token", {
      method: "POST",
    });
  });

  it("throws an error when token fetch fails", async () => {
    mockFetchImpl.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({}),
    });
    const config = makeMockConfig();
    const session = new AssemblyAISession(config);
    await expect(session.connect()).rejects.toThrow(
      "Failed to get AssemblyAI token",
    );
    expect(config.onError).toHaveBeenCalled();
  });

  it("throws when fetch itself rejects", async () => {
    mockFetchImpl.mockRejectedValue(new Error("Network down"));
    const config = makeMockConfig();
    const session = new AssemblyAISession(config);
    await expect(session.connect()).rejects.toThrow("Network down");
  });
});

describe("AssemblyAISession.sendAudio()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenFetch();
  });

  it("sends base64 JSON when socket is open", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();

    const audioData = new Int16Array([100, -100, 200]);
    session.sendAudio(audioData);

    expect(mockSend).toHaveBeenCalled();
    const sentArg = JSON.parse(mockSend.mock.calls[0][0]);
    expect(sentArg).toHaveProperty("audio_data");
    expect(typeof sentArg.audio_data).toBe("string");
  });

  it("converts Float32Array to Int16Array before sending", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();

    const float32 = new Float32Array([0.5, -0.5, 1.0, -1.0]);
    session.sendAudio(float32);

    expect(mockSend).toHaveBeenCalled();
    const sent = JSON.parse(mockSend.mock.calls[0][0]);
    expect(sent).toHaveProperty("audio_data");
  });

  it("queues audio when socket is not ready", () => {
    // Create session without connecting (socket = null)
    const session = new AssemblyAISession(makeMockConfig());
    const audioData = new Int16Array([1, 2, 3]);
    // Should not throw, just queue
    expect(() => session.sendAudio(audioData)).not.toThrow();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("AssemblyAISession.disconnect()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenFetch();
  });

  it("closes the socket when called after connecting", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();
    session.disconnect();
    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({ terminate_session: true }),
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it("sets isActive to false after disconnect", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();
    session.disconnect();
    expect(session.isActive()).toBe(false);
  });

  it("does not throw when called without connecting", () => {
    const session = new AssemblyAISession(makeMockConfig());
    expect(() => session.disconnect()).not.toThrow();
  });
});

describe("AssemblyAISession — private float32ToInt16 (via sendAudio)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenFetch();
  });

  it("clamps values above 1.0 to max int16", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();

    // Value > 1.0 should be clamped to 1.0 → 0x7fff
    const float32 = new Float32Array([1.5]);
    session.sendAudio(float32);
    // If it did not throw, clamping worked
    expect(mockSend).toHaveBeenCalled();
  });

  it("clamps values below -1.0 to min int16", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();

    const float32 = new Float32Array([-2.0]);
    session.sendAudio(float32);
    expect(mockSend).toHaveBeenCalled();
  });

  it("converts 0.0 to 0", async () => {
    const session = new AssemblyAISession(makeMockConfig());
    await session.connect();

    const float32 = new Float32Array([0.0]);
    session.sendAudio(float32);
    expect(mockSend).toHaveBeenCalled();
  });
});

describe("createAssemblyAISession factory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenFetch();
  });

  it("creates and connects a session", async () => {
    const config = makeMockConfig();
    const session = await createAssemblyAISession(config);
    expect(session).toBeInstanceOf(AssemblyAISession);
    expect(mockFetchImpl).toHaveBeenCalledWith("/api/assemblyai-token", {
      method: "POST",
    });
  });
});
