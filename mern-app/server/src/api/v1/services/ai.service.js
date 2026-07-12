import { GoogleGenAI } from '@google/genai';
import env from '../../../config/env.js';
import ApiError from '../../../utils/ApiError.js';
import logger from '../../../utils/logger.js';

/**
 * All Gemini / AssemblyAI access lives here. The permanent API keys never
 * leave the server: the browser gets single-use ephemeral tokens (Gemini
 * Live) and short-lived realtime tokens (AssemblyAI) instead.
 */

let cachedGemini = null;

function gemini() {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(503, 'AI features are not configured on this server');
  }
  if (!cachedGemini) {
    cachedGemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return cachedGemini;
}

function extractJson(text, opener = '{', closer = '}') {
  const start = text.indexOf(opener);
  const end = text.lastIndexOf(closer);
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Single-use ephemeral token for the browser's Gemini Live connection. */
export async function createGeminiLiveToken() {
  const now = Date.now();
  const token = await gemini().authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
      httpOptions: { apiVersion: 'v1alpha' },
    },
  });
  return token.name;
}

/** Short-lived AssemblyAI realtime token for streaming transcription. */
export async function createAssemblyAiToken() {
  if (!env.ASSEMBLYAI_API_KEY) {
    throw new ApiError(503, 'Transcription is not configured on this server');
  }

  const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
    method: 'POST',
    headers: {
      authorization: env.ASSEMBLYAI_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expires_in: 600 }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error('[ai] AssemblyAI token request failed:', response.status, detail);
    throw new ApiError(502, 'Failed to create transcription session');
  }

  const { token } = await response.json();
  return token;
}

/** OCR: extract text from an uploaded image via Gemini Vision. */
export async function extractTextFromImage(base64Image, mimeType) {
  const result = await gemini().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Extract all text from this image. Return only the text content, nothing else.',
          },
          { inlineData: { data: base64Image, mimeType } },
        ],
      },
    ],
  });
  return result.text || '';
}

/** Resume-vs-JD analysis (match score, skills gap, focus areas). */
export async function analyzeResume(resumeText, jobDescription = '') {
  const resume = resumeText.slice(0, 30000);
  const jd = (jobDescription || '').slice(0, 15000);

  const prompt = `Analyze this resume${jd ? ' against the job description' : ''} and provide a comprehensive analysis.

Resume:
${resume}

${jd ? `Job Description:\n${jd}\n` : ''}

Provide response in valid JSON format with:
- matchScore (0-100 number, how well resume matches JD)
- roleFitSummary (string, 1-2 sentences on overall fit)
- seniorityAlignment (string, e.g. "Junior", "Mid-level", "Senior")
- skillsGap (object with matchingSkills array and missingSkills array)
- improvementSuggestions (array of 3-5 actionable strings to improve resume)
- interviewFocusAreas (array of 5-7 topics interviewer will likely focus on)

Be specific and actionable.`;

  const result = await gemini().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const analysis = extractJson(result.text || '');
  if (!analysis) {
    throw new Error('Failed to parse resume analysis from AI response');
  }
  return analysis;
}

/**
 * Post-interview scorecard generation. Port of the original scoring prompt:
 * weighted rubric, hiring decision bands, CV/JD alignment, per-question
 * feedback, plus deterministic fallbacks for fields the model omits.
 */
export async function generateInterviewFeedback({
  transcript,
  config,
  resumeText,
  jobDescription,
}) {
  const hasResume = !!(resumeText && resumeText.trim().length > 50);
  const hasJD = !!(jobDescription && jobDescription.trim().length > 50);

  const conversationText = transcript
    .filter((m) => m.text && m.text !== 'Start the interview now.')
    .map((m) => `[${m.role === 'model' ? 'INTERVIEWER' : 'CANDIDATE'}]: ${m.text}`)
    .join('\n\n');

  const questionCount = transcript.filter(
    (m) => m.role === 'model' && m.text && m.text !== 'Start the interview now.'
  ).length;

  const cvBlock = hasResume
    ? `\n\n## CANDIDATE RESUME / CV\n\`\`\`\n${resumeText.substring(0, 4000)}\n\`\`\``
    : `\n\n## CANDIDATE RESUME / CV\n⚠️ NOT PROVIDED. You have NO information about this candidate's background. Do NOT invent, assume, or infer any resume details. The CV Alignment score must be 0 and cvAlignmentFeedback must state that no CV was provided.`;

  const jdBlock = hasJD
    ? `\n\n## JOB DESCRIPTION BEING INTERVIEWED FOR\n\`\`\`\n${jobDescription.substring(0, 3000)}\n\`\`\``
    : `\n\n## JOB DESCRIPTION\n⚠️ NOT PROVIDED. Do not invent role requirements.`;

  const cvRubricLine = hasResume
    ? `- **CV Alignment** (10%) — Did their answers actually match the skills/experience they claimed on their CV?`
    : `- **CV Alignment** — SKIP. No CV provided. Set cvAlignment score to 0. Do not evaluate this.`;

  const jdOutputLine = hasJD
    ? `"jdAlignmentFeedback": "<paragraph: how well their profile matches the specific JD requirements>",`
    : `"jdAlignmentFeedback": "No job description was provided for this session.",`;

  const cvAlignmentOutputInstruction = hasResume
    ? `"cvAlignmentFeedback": "<paragraph: which CV claims were substantiated vs. which were thin or unverifiable during the interview>",`
    : `"cvAlignmentFeedback": "No CV/resume was provided for this interview session. CV alignment cannot be assessed.",`;

  // Weights adjusted for the voice-only interview format (communication is
  // already implicit in every technical answer, so it is weighted lower).
  const technicalWeight = hasResume ? 35 : 40;
  const problemWeight = 30;
  const commWeight = hasResume ? 15 : 20;
  const culturalWeight = 10;

  const prompt = `You are a Senior Hiring Manager and Technical Interviewer with 15+ years of experience at top-tier technology companies. You have just conducted a ${config.type} interview for a **${config.level} ${config.role}** position.

Your task is to produce a **rigorous, authentic post-interview scorecard** — exactly as you would file internally after a real interview loop. Do NOT be generous or inflated. Be honest. A score of 70 means genuinely solid but with clear gaps. A score of 90+ means exceptional candidate. Most candidates score in the 50–75 range.

🚨 CRITICAL RULE: Base your evaluation ONLY on what appears in the transcript below. Do NOT invent, assume, or infer background information not present in the data given to you.
${cvBlock}
${jdBlock}

## INTERVIEW TRANSCRIPT
${conversationText}

---

## EVALUATION RUBRIC (use these weights):
- **Technical Knowledge** (${technicalWeight}%) — Depth, accuracy, and breadth of domain knowledge
- **Problem-Solving** (${problemWeight}%) — Structure of thinking, handling ambiguity, working through problems
- **Communication Clarity** (${commWeight}%) — Conciseness, structure, ability to explain complex ideas simply
- **Cultural & Behavioral** (${culturalWeight}%) — Professionalism, growth mindset, self-awareness, team-orientation
${cvRubricLine}

## SCORING INSTRUCTIONS
- Score each rubric category from **0 to 10** (0=No answer/No knowledge, 5=Average/Adequate, 7=Good, 9=Excellent, 10=Exceptional)
- **Each category MUST be scored independently.** Real candidates are almost never equal across all dimensions. Flat scores (e.g., all 7s) are unrealistic — vary your scores based on actual evidence.
- **performanceScore** (0-100): Weighted aggregate of the category scores. If CV Alignment is skipped, redistribute weight proportionally. Round to nearest integer.
- **hiringDecision** (this is the PRIMARY output — use industry-standard bands):
  - "Strong Hire" = performanceScore ≥ 85 AND no critical gaps in any category
  - "Hire" = performanceScore 70-84 AND role requirements substantially met
  - "Borderline" = performanceScore 55-69 OR mixed signals across categories
  - "No Hire" = performanceScore < 55 OR critical skill gaps that cannot be trained quickly

## UNANSWERED QUESTION PENALTY
If the candidate says "I don't know", gives a clearly wrong answer, or dodges/avoids a question entirely:
- Score that question 0-2 in perQuestionFeedback
- This MUST negatively impact the relevant category score
- Note the gap explicitly in weaknesses
- A single "I don't know" is acceptable and shows honesty. Three or more indicates insufficient preparation.

## CALIBRATION FOR INTERVIEW LENGTH
This interview contained approximately ${questionCount} interviewer turns.
- For short interviews (3-5 questions): You have LIMITED data. Be conservative — do not give high scores without strong evidence.
- For standard interviews (6-10 questions): Normal evaluation.
- For long interviews (11+ questions): Your scores should be well-substantiated with multiple data points per category.

${hasResume ? `## CV ALIGNMENT ANALYSIS
Carefully compare what the candidate *claimed* in their CV versus what they *demonstrated* during the interview:
- Did they show genuine depth in skills they listed?
- Were any claimed skills not evident at all?
- Were their project descriptions reflected in their answers?` : ''}

## OUTPUT FORMAT
Respond ONLY with valid JSON matching this exact structure (no markdown fences, no extra text):

{
  "performanceScore": <integer 0-100>,
  "hiringDecision": "<Strong Hire | Hire | Borderline | No Hire>",
  "hiringRationale": "<2-3 sentence narrative justifying the hiring decision, based ONLY on what was observed in the transcript>",

  "categoryScores": {
    "technicalKnowledge": <0-10>,
    "problemSolving": <0-10>,
    "communicationClarity": <0-10>,
    "culturalAndBehavioral": <0-10>,
    "cvAlignment": ${hasResume ? '<0-10>' : '0'}
  },

  "communicationSkills": "<detailed paragraph assessing how they communicated — structure, clarity, vocabulary, listening>",
  "technicalAccuracy": "<detailed paragraph assessing technical depth, correctness of content, industry-standard knowledge>",
  ${cvAlignmentOutputInstruction}
  ${jdOutputLine}

  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", "<specific weakness 3>"],
  "improvementTips": [
    "<actionable tip 1 — be very specific, e.g. 'Study distributed systems consistency models'>",
    "<actionable tip 2>",
    "<actionable tip 3>"
  ],

  "perQuestionFeedback": [
    {
      "question": "<the interviewer's exact question or paraphrased topic>",
      "candidateAnswer": "<brief summary of candidate's response>",
      "evaluation": "<specific evaluation of quality and accuracy of this answer>",
      "score": <0-10>
    }
  ]
}`;

  const result = await gemini().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.3,
      thinkingConfig: { thinkingBudget: 8000 },
    },
  });

  const feedback = extractJson(result.text || '');
  if (!feedback) {
    throw new Error('Failed to parse feedback JSON from AI response');
  }

  // Enforce: if no resume, override any hallucinated CV data.
  if (!hasResume) {
    feedback.categoryScores = {
      ...(feedback.categoryScores || {}),
      cvAlignment: 0,
    };
    feedback.cvAlignmentFeedback =
      'No CV/resume was provided for this interview session. CV alignment cannot be assessed.';
  }

  // Deterministic fallbacks for fields the model occasionally omits.
  const base = feedback.performanceScore || 60;
  if (!feedback.categoryScores) {
    const clamp = (n) => Math.min(10, Math.max(0, Math.round(n)));
    feedback.categoryScores = {
      technicalKnowledge: clamp(base / 10),
      problemSolving: clamp((base - 5) / 10),
      communicationClarity: clamp((base + 5) / 10),
      culturalAndBehavioral: clamp((base + 3) / 10),
      cvAlignment: hasResume ? clamp((base - 3) / 10) : 0,
    };
  }
  if (!feedback.overallGrade) {
    feedback.overallGrade =
      base >= 90 ? 'A' : base >= 85 ? 'A-' : base >= 80 ? 'B+' : base >= 75 ? 'B' : base >= 70 ? 'B-' : base >= 65 ? 'C+' : base >= 60 ? 'C' : base >= 55 ? 'C-' : 'D';
  }
  if (!feedback.hiringDecision) {
    feedback.hiringDecision =
      base >= 85 ? 'Strong Hire' : base >= 70 ? 'Hire' : base >= 55 ? 'Borderline' : 'No Hire';
  }

  return feedback;
}
