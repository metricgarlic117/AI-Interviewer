/**
 * White Box Unit Tests: types.js
 * Verifies all enum-constant values and object shape.
 */

import {
    InterviewType,
    InterviewLevel,
    InterviewMode,
    ErrorSeverity,
    ErrorCode,
} from '../types';

describe('InterviewType enum', () => {
    it('has the correct string value for Technical', () => {
        expect(InterviewType.Technical).toBe('Technical');
    });

    it('has the correct string value for Behavioral', () => {
        expect(InterviewType.Behavioral).toBe('Behavioral');
    });

    it('has the correct string value for Mixed', () => {
        expect(InterviewType.Mixed).toBe('Mixed');
    });

    it('has exactly 3 members', () => {
        const members = Object.keys(InterviewType);
        expect(members).toHaveLength(3);
    });
});

describe('InterviewLevel enum', () => {
    it('has the correct value for Intern', () => {
        expect(InterviewLevel.Intern).toBe('Intern');
    });

    it('has the correct value for Junior', () => {
        expect(InterviewLevel.Junior).toBe('Junior');
    });

    it('has the correct value for Senior', () => {
        expect(InterviewLevel.Senior).toBe('Senior');
    });

    it('has exactly 3 members', () => {
        const members = Object.keys(InterviewLevel);
        expect(members).toHaveLength(3);
    });
});

describe('InterviewMode enum', () => {
    it('has the correct value for Coach', () => {
        expect(InterviewMode.Coach).toBe('Friendly Coach');
    });

    it('has the correct value for Realistic', () => {
        expect(InterviewMode.Realistic).toBe('Realistic Interviewer');
    });

    it('has the correct value for Stress', () => {
        expect(InterviewMode.Stress).toBe('Stress Mode');
    });

    it('has exactly 3 members', () => {
        const members = Object.keys(InterviewMode);
        expect(members).toHaveLength(3);
    });
});

describe('ErrorSeverity enum', () => {
    it('has the correct value for INFO', () => {
        expect(ErrorSeverity.INFO).toBe('info');
    });

    it('has the correct value for WARNING', () => {
        expect(ErrorSeverity.WARNING).toBe('warning');
    });

    it('has the correct value for ERROR', () => {
        expect(ErrorSeverity.ERROR).toBe('error');
    });

    it('has the correct value for FATAL', () => {
        expect(ErrorSeverity.FATAL).toBe('fatal');
    });

    it('has exactly 4 members', () => {
        const members = Object.keys(ErrorSeverity);
        expect(members).toHaveLength(4);
    });
});

describe('ErrorCode enum', () => {
    it('has MIC_PERMISSION_DENIED', () => {
        expect(ErrorCode.MIC_PERMISSION_DENIED).toBe('MIC_PERMISSION_DENIED');
    });

    it('has MIC_DEVICE_NOT_FOUND', () => {
        expect(ErrorCode.MIC_DEVICE_NOT_FOUND).toBe('MIC_DEVICE_NOT_FOUND');
    });

    it('has AUDIO_CONTEXT_FAILED', () => {
        expect(ErrorCode.AUDIO_CONTEXT_FAILED).toBe('AUDIO_CONTEXT_FAILED');
    });

    it('has NETWORK_OFFLINE', () => {
        expect(ErrorCode.NETWORK_OFFLINE).toBe('NETWORK_OFFLINE');
    });

    it('has GEMINI_API_ERROR', () => {
        expect(ErrorCode.GEMINI_API_ERROR).toBe('GEMINI_API_ERROR');
    });

    it('has GEMINI_RATE_LIMIT', () => {
        expect(ErrorCode.GEMINI_RATE_LIMIT).toBe('GEMINI_RATE_LIMIT');
    });

    it('has GEMINI_CONNECTION_CLOSED', () => {
        expect(ErrorCode.GEMINI_CONNECTION_CLOSED).toBe('GEMINI_CONNECTION_CLOSED');
    });

    it('has SESSION_STALE', () => {
        expect(ErrorCode.SESSION_STALE).toBe('SESSION_STALE');
    });

    it('has PARSING_ERROR', () => {
        expect(ErrorCode.PARSING_ERROR).toBe('PARSING_ERROR');
    });

    it('has UNKNOWN_ERROR', () => {
        expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });

    it('has exactly 10 members', () => {
        const members = Object.keys(ErrorCode);
        expect(members).toHaveLength(10);
    });
});
