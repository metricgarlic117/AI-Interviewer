import { NextResponse } from 'next/server';
import { createApiHandler, badRequest } from '@/lib/server/api-handler';
import { geminiClient } from '@/lib/server/gemini-client';

const MAX_RESUME_CHARS = 30_000;
const MAX_JD_CHARS = 15_000;

export const POST = createApiHandler(
  'analyze-resume',
  async ({ body }) => {
    const { resumeText, jobDescription } = body;

    if (!resumeText || typeof resumeText !== 'string' || !resumeText.trim()) {
      throw badRequest('Resume text is required');
    }
    if (jobDescription !== undefined && typeof jobDescription !== 'string') {
      throw badRequest('Job description must be a string');
    }

    const resume = resumeText.slice(0, MAX_RESUME_CHARS);
    const jd = (jobDescription || '').slice(0, MAX_JD_CHARS);

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

    const result = await geminiClient().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = result.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return NextResponse.json(analysis);
    }

    throw new Error('Failed to parse resume analysis');
  },
  {
    rateLimit: { limit: 10, windowMs: 60_000 },
    maxBodyBytes: 512 * 1024,
  }
);
