import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: NextRequest) {
    try {
        const { resumeText, jobDescription } = await request.json();

        if (!resumeText) {
            return NextResponse.json(
                { error: 'Resume text is required' },
                { status: 400 }
            );
        }

        const prompt = `Analyze this resume${jobDescription ? ' against the job description' : ''} and provide a comprehensive analysis.

Resume:
${resumeText}

${jobDescription ? `Job Description:\n${jobDescription}\n` : ''}

Provide response in valid JSON format with:
- matchScore (0-100 number, how well resume matches JD)
- roleFitSummary (string, 1-2 sentences on overall fit)
- seniorityAlignment (string, e.g. "Junior", "Mid-level", "Senior")
- skillsGap (object with matchingSkills array and missingSkills array)
- improvementSuggestions (array of 3-5 actionable strings to improve resume)
- interviewFocusAreas (array of 5-7 topics interviewer will likely focus on)

Be specific and actionable.`;

        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        const text = result.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return NextResponse.json(analysis);
        }

        throw new Error('Failed to parse resume analysis');
    } catch (error: any) {
        console.error('Error analyzing resume:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to analyze resume' },
            { status: 500 }
        );
    }
}
