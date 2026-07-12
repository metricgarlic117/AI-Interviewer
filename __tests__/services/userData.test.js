/**
 * White Box Unit Tests: services/userData.ts
 * All Firebase Firestore calls are mocked.
 */

// Mock firebase/firestore
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockDoc = jest.fn((_, ...pathSegments) => ({
  path: pathSegments.join("/"),
}));
const mockCollection = jest.fn((_, path) => ({ path }));
const mockQuery = jest.fn((ref) => ref);
const mockOrderBy = jest.fn();
const mockGetDocs = jest.fn();
const mockLimit = jest.fn();

jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  orderBy: (...args) => mockOrderBy(...args),
  getDocs: (...args) => mockGetDocs(...args),
  limit: (...args) => mockLimit(...args),
}));

// Mock the firebase service (our module)
jest.mock("../../services/firebase", () => ({
  db: {},
}));

import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  saveResume,
  getResume,
  saveJobDescription,
  getJobDescription,
  saveMessage,
  getSessionMessages,
  saveFullResumeAnalysis,
  getResumeAnalysisWithData,
  processInterviewFeedback,
} from "../../services/userData";

afterEach(() => jest.clearAllMocks());

// --- createUserProfile ---
describe("createUserProfile", () => {
  it("calls setDoc with user data and createdAt timestamp", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await createUserProfile("user-1", { name: "Alice" });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.name).toBe("Alice");
    expect(data.createdAt).toBeDefined();
    expect(typeof data.createdAt).toBe("string");
  });

  it("rethrows errors from setDoc", async () => {
    mockSetDoc.mockRejectedValue(new Error("Firestore write failed"));
    await expect(createUserProfile("user-1", {})).rejects.toThrow(
      "Firestore write failed",
    );
  });
});

// --- getUserProfile ---
describe("getUserProfile", () => {
  it("returns data when document exists", async () => {
    const userData = { name: "Bob", email: "bob@example.com" };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => userData });
    const result = await getUserProfile("user-2");
    expect(result).toEqual(userData);
  });

  it("returns null when document does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
    const result = await getUserProfile("nonexistent");
    expect(result).toBeNull();
  });

  it("rethrows errors", async () => {
    mockGetDoc.mockRejectedValue(new Error("Permission denied"));
    await expect(getUserProfile("user-3")).rejects.toThrow("Permission denied");
  });
});

// --- updateUserProfile ---
describe("updateUserProfile", () => {
  it("calls updateDoc with the provided data", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updateUserProfile("user-4", { name: "Charlie Updated" });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [, data] = mockUpdateDoc.mock.calls[0];
    expect(data.name).toBe("Charlie Updated");
  });

  it("rethrows errors from updateDoc", async () => {
    mockUpdateDoc.mockRejectedValue(new Error("Update failed"));
    await expect(updateUserProfile("user-4", {})).rejects.toThrow(
      "Update failed",
    );
  });
});

// --- saveResume ---
describe("saveResume", () => {
  it("calls addDoc and returns the new document ID", async () => {
    mockAddDoc.mockResolvedValue({ id: "resume-id-123" });
    const id = await saveResume("user-5", "My resume text", "resume.pdf");
    expect(id).toBe("resume-id-123");
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it("includes the fileName and text in the saved data", async () => {
    mockAddDoc.mockResolvedValue({ id: "r1" });
    await saveResume("user-5", "My resume text", "cv.pdf");
    const [, data] = mockAddDoc.mock.calls[0];
    expect(data.text).toBe("My resume text");
    expect(data.fileName).toBe("cv.pdf");
  });

  it("rethrows errors", async () => {
    mockAddDoc.mockRejectedValue(new Error("Add failed"));
    await expect(saveResume("user-5", "text", "file.pdf")).rejects.toThrow(
      "Add failed",
    );
  });
});

// --- getResume ---
describe("getResume", () => {
  it("returns text and fileName when resume exists", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ text: "resume body", fileName: "cv.pdf" }),
    });
    const result = await getResume("user-6", "resume-abc");
    expect(result).toEqual({ text: "resume body", fileName: "cv.pdf" });
  });

  it("returns null when resume does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getResume("user-6", "missing");
    expect(result).toBeNull();
  });
});

// --- saveJobDescription ---
describe("saveJobDescription", () => {
  it("calls addDoc and returns the new doc ID", async () => {
    mockAddDoc.mockResolvedValue({ id: "jd-id-456" });
    const id = await saveJobDescription("user-7", "We are looking for...");
    expect(id).toBe("jd-id-456");
  });

  it("stores the text field", async () => {
    mockAddDoc.mockResolvedValue({ id: "j1" });
    await saveJobDescription("user-7", "Engineer role");
    const [, data] = mockAddDoc.mock.calls[0];
    expect(data.text).toBe("Engineer role");
  });

  it("rethrows errors", async () => {
    mockAddDoc.mockRejectedValue(new Error("JD save failed"));
    await expect(saveJobDescription("user-7", "desc")).rejects.toThrow(
      "JD save failed",
    );
  });
});

// --- getJobDescription ---
describe("getJobDescription", () => {
  it("returns the text content when JD exists", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ text: "Software Engineer at Acme", createdAt: 123 }),
    });
    const result = await getJobDescription("user-8", "jd-xyz");
    expect(result).toBe("Software Engineer at Acme");
  });

  it("returns null when JD does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getJobDescription("user-8", "missing-jd");
    expect(result).toBeNull();
  });
});

// --- saveMessage ---
describe("saveMessage", () => {
  it("calls addDoc with a timestamp attached", async () => {
    mockAddDoc.mockResolvedValue({ id: "msg-1" });
    await saveMessage("user-9", "interview-1", { role: "user", text: "Hello" });
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, data] = mockAddDoc.mock.calls[0];
    expect(data.role).toBe("user");
    expect(data.text).toBe("Hello");
    expect(data.timestamp).toBeDefined();
  });

  it("does NOT throw even if addDoc fails (non-blocking)", async () => {
    mockAddDoc.mockRejectedValue(new Error("DB error"));
    await expect(
      saveMessage("user-9", "int-1", { text: "hi" }),
    ).resolves.not.toThrow();
  });
});

// --- getSessionMessages ---
describe("getSessionMessages", () => {
  it("returns an array of message data", async () => {
    const mockDocs = [
      { data: () => ({ role: "model", text: "Hi there", timestamp: 1000 }) },
      { data: () => ({ role: "user", text: "Hello", timestamp: 2000 }) },
    ];
    mockGetDocs.mockResolvedValue({ docs: mockDocs });
    const result = await getSessionMessages("user-10", "interview-2");
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("model");
    expect(result[1].role).toBe("user");
  });

  it("returns empty array when getDocs fails", async () => {
    mockGetDocs.mockRejectedValue(new Error("Query failed"));
    const result = await getSessionMessages("user-10", "interview-3");
    expect(result).toEqual([]);
  });
});

// --- saveFullResumeAnalysis ---
describe("saveFullResumeAnalysis", () => {
  it("calls setDoc twice: once for resumeAnalysis and once for prepContext", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const analysis = {
      roleFitSummary: "Software Engineer role",
      seniorityAlignment: "Senior",
    };
    await saveFullResumeAnalysis(
      "user-11",
      "resume-1",
      "cv.pdf",
      "jd-1",
      analysis,
    );
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it("rethrows errors", async () => {
    mockSetDoc.mockRejectedValue(new Error("Write failed"));
    await expect(
      saveFullResumeAnalysis("user-11", "r1", "cv.pdf", "jd1", {}),
    ).rejects.toThrow("Write failed");
  });
});

// --- getResumeAnalysisWithData ---
describe("getResumeAnalysisWithData", () => {
  it("returns null when no analysis document exists", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getResumeAnalysisWithData("user-12");
    expect(result).toBeNull();
  });

  it("hydrates resume and JD data when both IDs are present", async () => {
    const analysisData = {
      resumeId: "r1",
      jobDescriptionId: "jd1",
      analysis: {},
    };
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => analysisData }) // analysis doc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ text: "resume body", fileName: "cv.pdf" }),
      }) // resume
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ text: "Job description text" }),
      }); // JD

    const result = await getResumeAnalysisWithData("user-12");
    expect(result?.resumeText).toBe("resume body");
    expect(result?.jobDescription).toBe("Job description text");
  });

  it("returns empty strings when resume and JD are missing", async () => {
    const analysisData = {
      resumeId: null,
      jobDescriptionId: null,
      analysis: {},
    };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => analysisData,
    });

    const result = await getResumeAnalysisWithData("user-12");
    expect(result?.resumeText).toBe("");
    expect(result?.jobDescription).toBe("");
  });
});

// --- processInterviewFeedback ---
describe("processInterviewFeedback", () => {
  it("calls updateDoc with completed status", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);

    const feedback = { performanceScore: 80, weaknesses: [] };
    await processInterviewFeedback(
      "user-13",
      "session-1",
      feedback,
      "Engineer",
    );

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [, data] = mockUpdateDoc.mock.calls[0];
    expect(data.status).toBe("completed");
    expect(data.feedback).toEqual(feedback);
  });

  it("creates a recommendation when score < 70 and weaknesses exist", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);

    const feedback = { performanceScore: 55, weaknesses: ["Problem solving"] };
    await processInterviewFeedback(
      "user-13",
      "session-2",
      feedback,
      "Engineer",
    );

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.type).toBe("review_weakness");
    expect(data.message).toContain("Problem solving");
  });

  it("does NOT create recommendation when score >= 70", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);

    const feedback = { performanceScore: 75, weaknesses: ["Some weakness"] };
    await processInterviewFeedback(
      "user-13",
      "session-3",
      feedback,
      "Engineer",
    );

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("does NOT create recommendation when no weaknesses exist (even if score < 70)", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);

    const feedback = { performanceScore: 40, weaknesses: [] };
    await processInterviewFeedback(
      "user-13",
      "session-4",
      feedback,
      "Engineer",
    );

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("rethrows errors from updateDoc", async () => {
    mockUpdateDoc.mockRejectedValue(new Error("Update failed"));
    await expect(
      processInterviewFeedback(
        "user-13",
        "session-5",
        { performanceScore: 80, weaknesses: [] },
        "Dev",
      ),
    ).rejects.toThrow("Update failed");
  });
});
