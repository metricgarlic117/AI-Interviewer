/**
 * Shared runtime constants and data-shape documentation.
 *
 * The enum-like objects below are frozen so accidental mutation fails loudly.
 * Data shapes (interview config, feedback, etc.) are documented as JSDoc
 * typedefs so editors still provide completion without TypeScript.
 */

export const InterviewType = Object.freeze({
  Technical: 'Technical',
  Behavioral: 'Behavioral',
  Mixed: 'Mixed',
});

export const InterviewLevel = Object.freeze({
  Intern: 'Intern',
  Junior: 'Junior',
  Senior: 'Senior',
});

export const InterviewMode = Object.freeze({
  Coach: 'Friendly Coach',
  Realistic: 'Realistic Interviewer',
  Stress: 'Stress Mode',
});

// --- ERROR HANDLING SYSTEM ---

export const ErrorSeverity = Object.freeze({
  INFO: 'info',       // Ephemeral, e.g., "Retrying connection..."
  WARNING: 'warning', // Non-blocking, e.g., "Speech not recognized"
  ERROR: 'error',     // Blocking current action, e.g., "Gemini API Timeout"
  FATAL: 'fatal',     // App crashing, e.g., "Mic Device Not Found"
});

export const ErrorCode = Object.freeze({
  // Client / Hardware
  MIC_PERMISSION_DENIED: 'MIC_PERMISSION_DENIED',
  MIC_DEVICE_NOT_FOUND: 'MIC_DEVICE_NOT_FOUND',
  AUDIO_CONTEXT_FAILED: 'AUDIO_CONTEXT_FAILED',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',

  // AI / Server
  GEMINI_API_ERROR: 'GEMINI_API_ERROR',
  GEMINI_RATE_LIMIT: 'GEMINI_RATE_LIMIT',
  GEMINI_CONNECTION_CLOSED: 'GEMINI_CONNECTION_CLOSED',

  // Logic
  SESSION_STALE: 'SESSION_STALE',
  PARSING_ERROR: 'PARSING_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
});

/**
 * @typedef {Object} InterviewConfig
 * @property {string} role
 * @property {string} type - One of InterviewType
 * @property {string} level - One of InterviewLevel
 * @property {string} mode - One of InterviewMode
 * @property {string} techStack
 * @property {number} questionCount
 * @property {string} [jobDescription]
 * @property {string} [resumeText]
 * @property {string} [resumeId]
 * @property {string} [jdId]
 */

/**
 * @typedef {Object} Message
 * @property {'user'|'model'} role
 * @property {string} text
 * @property {number} timestamp
 */

/**
 * @typedef {Object} Feedback
 * @property {number} performanceScore - 0-100 overall aggregate
 * @property {string} overallGrade - e.g. "A", "B+", "C-"
 * @property {'Strong Hire'|'Hire'|'Borderline'|'No Hire'} hiringDecision
 * @property {string} hiringRationale - 2-3 sentence narrative
 * @property {{technicalKnowledge: number, problemSolving: number, communicationClarity: number, culturalAndBehavioral: number, cvAlignment: number}} categoryScores - each 0-10
 * @property {string} communicationSkills
 * @property {string} technicalAccuracy
 * @property {string} cvAlignmentFeedback - Did answers match CV claims?
 * @property {string} [jdAlignmentFeedback] - Match against job description (if provided)
 * @property {string[]} strengths
 * @property {string[]} weaknesses
 * @property {string[]} improvementTips
 * @property {Array<{question: string, candidateAnswer: string, evaluation: string, score: number}>} [perQuestionFeedback]
 */

/**
 * @typedef {Object} InterviewSession
 * @property {string} id
 * @property {string} userId
 * @property {InterviewConfig} config
 * @property {number} createdAt
 * @property {'in-progress'|'completed'} status
 * @property {Message[]} messages
 * @property {Feedback} [feedback]
 * @property {string} [interviewerPersona] - System prompt for interviewer
 */

/**
 * @typedef {Object} ResumeAnalysis
 * @property {number} matchScore
 * @property {string} roleFitSummary
 * @property {string} seniorityAlignment
 * @property {{matchingSkills: string[], missingSkills: string[]}} skillsGap
 * @property {string[]} improvementSuggestions
 * @property {string[]} interviewFocusAreas
 */

/**
 * @typedef {Object} PrepContext
 * @property {string} targetRole
 * @property {string} [targetCompany]
 * @property {string} seniorityLevel
 * @property {number} lastUpdated
 */

/**
 * @typedef {Object} Recommendation
 * @property {'analyze_resume'|'practice_interview'|'review_weakness'} type
 * @property {string} message
 * @property {string} targetAction - URL path
 * @property {string} reason
 * @property {number} generatedAt
 */

/**
 * @typedef {Object} AppError
 * @property {string} code - One of ErrorCode
 * @property {string} message
 * @property {string} severity - One of ErrorSeverity
 * @property {*} [originalError]
 * @property {Function} [retryAction]
 */
