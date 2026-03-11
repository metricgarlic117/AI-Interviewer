export enum InterviewType {
  Technical = 'Technical',
  Behavioral = 'Behavioral',
  Mixed = 'Mixed'
}

export enum InterviewLevel {
  Intern = 'Intern',
  Junior = 'Junior',
  Senior = 'Senior'
}

export enum InterviewMode {
  Coach = 'Friendly Coach',
  Realistic = 'Realistic Interviewer',
  Stress = 'Stress Mode'
}

export interface InterviewConfig {
  role: string;
  type: InterviewType;
  level: InterviewLevel;
  mode: InterviewMode;
  techStack: string;
  questionCount: number;
  jobDescription?: string;
  resumeText?: string;
  resumeId?: string;
  jdId?: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface Feedback {
  // Core scores
  performanceScore: number;           // 0-100 overall aggregate
  overallGrade: string;               // e.g. "A", "B+", "C-"
  hiringDecision: 'Strong Hire' | 'Hire' | 'Borderline' | 'No Hire';
  hiringRationale: string;            // 2-3 sentence narrative

  // Category rubric scores (each 0-10)
  categoryScores: {
    technicalKnowledge: number;
    problemSolving: number;
    communicationClarity: number;
    culturalAndBehavioral: number;
    cvAlignment: number;
  };

  // Narrative assessments
  communicationSkills: string;
  technicalAccuracy: string;
  cvAlignmentFeedback: string;        // Did answers match CV claims?
  jdAlignmentFeedback?: string;       // Match against job description (if provided)

  // Lists
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];

  // Per-question breakdown
  perQuestionFeedback?: {
    question: string;
    candidateAnswer: string;
    evaluation: string;
    score: number;                    // 0-10
  }[];
}

export interface InterviewerPersona {
  name: string;
  role: string;
  company?: string;
  bio: string; // A brief description of their style and team context
}

export interface InterviewSession {
  id: string;
  userId: string;
  config: InterviewConfig;
  createdAt: number;
  status: 'in-progress' | 'completed';
  messages: Message[];
  feedback?: Feedback;
  interviewerPersona?: string; // System prompt for interviewer
}

export interface ResumeAnalysis {
  matchScore: number;
  roleFitSummary: string;
  seniorityAlignment: string;
  skillsGap: {
    matchingSkills: string[];
    missingSkills: string[];
  };
  improvementSuggestions: string[];
  interviewFocusAreas: string[];
}

// --- New Core Data Types ---

export interface PrepContext {
  targetRole: string;
  targetCompany?: string;
  seniorityLevel: string;
  lastUpdated: number;
}

export interface SkillConfidence {
  skillName: string;
  confidenceLevel: 'weak' | 'improving' | 'strong';
  lastUpdated: number;
  evidenceSource: 'resume' | 'interview';
}

export interface Recommendation {
  type: 'analyze_resume' | 'practice_interview' | 'review_weakness';
  message: string;
  targetAction: string; // URL path
  reason: string;
  generatedAt: number;
}

export interface ResumeData {
  id?: string;
  fileName: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface JobDescriptionData {
  id?: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ResumeAnalysisRecord {
  id?: string;
  resumeId: string;
  jobDescriptionId?: string;
  resumeFileName: string;
  analysis: ResumeAnalysis;
  analyzedAt: number;
}

// --- ERROR HANDLING SYSTEM ---

export enum ErrorSeverity {
  INFO = 'info',       // Ephemeral, e.g., "Retrying connection..."
  WARNING = 'warning', // Non-blocking, e.g., "Speech not recognized"
  ERROR = 'error',     // Blocking current action, e.g., "Gemini API Timeout"
  FATAL = 'fatal'      // App crashing, e.g., "Mic Device Not Found"
}

export enum ErrorCode {
  // Client / Hardware
  MIC_PERMISSION_DENIED = 'MIC_PERMISSION_DENIED',
  MIC_DEVICE_NOT_FOUND = 'MIC_DEVICE_NOT_FOUND',
  AUDIO_CONTEXT_FAILED = 'AUDIO_CONTEXT_FAILED',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',

  // AI / Server
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  GEMINI_RATE_LIMIT = 'GEMINI_RATE_LIMIT',
  GEMINI_CONNECTION_CLOSED = 'GEMINI_CONNECTION_CLOSED',

  // Logic
  SESSION_STALE = 'SESSION_STALE',
  PARSING_ERROR = 'PARSING_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  originalError?: any;
  retryAction?: () => void;
}