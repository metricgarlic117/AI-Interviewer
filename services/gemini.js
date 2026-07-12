import { GoogleGenAI } from "@google/genai";
import { authedFetch } from "./apiClient";

/**
 * Creates a Gemini client for the browser Live API connection.
 *
 * The permanent API key lives only on the server; the browser receives a
 * single-use, short-lived ephemeral token minted by /api/gemini-live-token.
 */
export async function createLiveClient() {
  const response = await authedFetch("/api/gemini-live-token", {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to start live session");
  }

  const { token } = await response.json();
  return new GoogleGenAI({
    apiKey: token,
    httpOptions: { apiVersion: "v1alpha" },
  });
}

// Extract text from images using Gemini Vision (needed by ResumeAnalyzer)
export async function extractTextFromImage(base64Image, mimeType) {
  try {
    const response = await authedFetch("/api/extract-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to extract text");
    }

    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Error extracting text from image:", error);
    throw error;
  }
}

// Generate interview feedback (needed by InterviewSession)
export async function generateInterviewFeedback(
  transcript,
  config,
  resumeText,
  jobDescription,
) {
  try {
    const response = await authedFetch("/api/generate-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, config, resumeText, jobDescription }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate feedback");
    }

    return await response.json();
  } catch (error) {
    console.error("Error generating interview feedback:", error);
    throw error;
  }
}

// Generate interviewer persona
export async function generateInterviewerPersona(config) {
  const modeInstructions = {
    "Friendly Coach":
      "MODE: Friendly Coach. Validation Score: High. If answer is weak, provide a specific hint. If strong, celebrate small wins.",
    "Realistic Interview":
      "MODE: Corporate Interviewer. Validation Score: Neutral. If answer is weak, note it and move on or ask for clarification. If strong, press for details.",
    "Stress Mode":
      "MODE: Stress Interview. Validation Score: Low/skeptical. Challenge every assumption. If answer is weak, interrupt. If strong, find an edge case.",
  };

  // Agentic for the AI
  return `
IDENTITY: You are an Elite Technical Interviewer Agent.
GOAL: Assess the candidate's TRUE depth of knowledge by dynamically adapting to their performance.
DO NOT blindly follow a script. Listen, Analyze, then React.

CONFIG:
- Role: ${config.role} (${config.level})
- Mode: ${modeInstructions[config.mode] || "Professional"}
- Tech Stack: ${config.techStack}

CONTEXT:
${config.jobDescription ? `TARGET ROLE REQUIREMENTS:\n${config.jobDescription.substring(0, 1500)}\n` : ""}
${config.resumeText ? `CANDIDATE PROFILE:\n${config.resumeText.substring(0, 2000)}\n` : ""}

CORE OPERATING LOOP (Internal Thought Process -> Output):
1. LISTEN to the candidate's response.
2. EVALUATE (Internal Monologue):
   - did they answer the core question? (Pass/Fail)
   - was it superficial or deep? (Depth Score 1-5)
   - did they mention specific experience from their resume?
3. ADAPT (Difficulty Adjustment):
   - IF WEAK Answer: Downgrade difficulty. Ask a "Rescue Question" (fundamental concept) to rebuild confidence.
   - IF AVERAGE Answer: Maintain level. Ask a "Deep Dive" follow-up on a specific part of their answer.
   - IF STRONG Answer: Upgrade difficulty. Ask a "Challenge Question" (scalability, edge case, security constraint).

RULES:
- Start with a standard open-ended question based on their Resume.
- If they mention a project, DRILL DOWN into it. Ask "What was your specific contribution?"
- If the Job Description mentions a specific tool (e.g. Docker), ask about it if they haven't mentioned it.
- ASK ONE QUESTION AT A TIME.
- TOTAL QUESTIONS: ${config.questionCount}. Track this internally.
- AT THE END: Say exactly "Thank you for your time. That concludes our interview."

Start the interview now with the first question.`;
}

export async function analyzeResume(resumeText, jobDescription = "") {
  try {
    const response = await authedFetch("/api/analyze-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, jobDescription }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to analyze resume");
    }

    return await response.json();
  } catch (error) {
    console.error("Error analyzing resume:", error);
    throw error;
  }
}
