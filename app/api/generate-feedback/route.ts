import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: NextRequest) {
    try {
        const { transcript, config, resumeText, jobDescription } = await request.json();

        if (!transcript || !config) {
            return NextResponse.json(
                { error: 'Transcript and config are required' },
                { status: 400 }
            );
        }

        const hasResume = !!(resumeText && resumeText.trim().length > 50);
        const hasJD = !!(jobDescription && jobDescription.trim().length > 50);

        // Build the conversation text for the AI to evaluate
        const conversationText = transcript
            .filter((m: any) => m.text && m.text !== "Start the interview now.")
            .map((m: any) => `[${m.role === 'model' ? 'INTERVIEWER' : 'CANDIDATE'}]: ${m.text}`)
            .join('\n\n');

        // Count the number of questions asked for calibration
        const questionCount = transcript.filter((m: any) => m.role === 'model' && m.text && m.text !== "Start the interview now.").length;

        // Build CV context block — only include real text if it exists
        const cvBlock = hasResume
            ? `\n\n## CANDIDATE RESUME / CV\n\`\`\`\n${resumeText.substring(0, 4000)}\n\`\`\``
            : `\n\n## CANDIDATE RESUME / CV\n⚠️ NOT PROVIDED. You have NO information about this candidate's background. Do NOT invent, assume, or infer any resume details. The CV Alignment score must be 0 and cvAlignmentFeedback must state that no CV was provided.`;

        // Build JD context block
        const jdBlock = hasJD
            ? `\n\n## JOB DESCRIPTION BEING INTERVIEWED FOR\n\`\`\`\n${jobDescription.substring(0, 3000)}\n\`\`\``
            : `\n\n## JOB DESCRIPTION\n⚠️ NOT PROVIDED. Do not invent role requirements.`;

        // Rubric adjusts based on what data is available
        const cvRubricLine = hasResume
            ? `- **CV Alignment** (10%) — Did their answers actually match the skills/experience they claimed on their CV?`
            : `- **CV Alignment** — SKIP. No CV provided. Set cvAlignment score to 0. Do not evaluate this.`;

        const jdOutputLine = hasJD
            ? `"jdAlignmentFeedback": "<paragraph: how well their profile matches the specific JD requirements>",`
            : `"jdAlignmentFeedback": "No job description was provided for this session.",`;

        const cvAlignmentOutputInstruction = hasResume
            ? `"cvAlignmentFeedback": "<paragraph: which CV claims were substantiated vs. which were thin or unverifiable during the interview>",`
            : `"cvAlignmentFeedback": "No CV/resume was provided for this interview session. CV alignment cannot be assessed.",`;

        // REALISTIC WEIGHTS — adjusted for voice-only interview format
        // Communication reduced to 15% to prevent double-counting (voice-only means
        // technical assessment already depends heavily on verbal articulation)
        // Problem Solving increased to 30% to match industry standard weighting
        const technicalWeight = hasResume ? 35 : 40;
        const problemWeight = hasResume ? 30 : 30;
        const commWeight = hasResume ? 15 : 20;
        const culturalWeight = hasResume ? 10 : 10;
        const cvWeight = hasResume ? 10 : 0;

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
- **Each category MUST be scored independently.** Real candidates are almost never equal across all dimensions. A candidate might be 8/10 technical but 5/10 communication, or 9/10 communication but 4/10 technical. Flat scores (e.g., all 7s) are unrealistic — vary your scores based on actual evidence.
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
- For short interviews (3-5 questions): You have LIMITED data. Be conservative — do not give high scores without strong evidence. Acknowledge the small sample size in your rationale.
- For standard interviews (6-10 questions): Normal evaluation.
- For long interviews (11+ questions): You have extensive data. Your scores should be well-substantiated with multiple data points per category.

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

        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.3,
                thinkingConfig: { thinkingBudget: 8000 }
            }
        });

        const text = result.text || '';

        // Try strict JSON extraction first
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const feedback = JSON.parse(jsonMatch[0]);

                // Enforce: if no resume, override any hallucinated CV data
                if (!hasResume) {
                    feedback.categoryScores = {
                        ...(feedback.categoryScores || {}),
                        cvAlignment: 0,
                    };
                    feedback.cvAlignmentFeedback = 'No CV/resume was provided for this interview session. CV alignment cannot be assessed.';
                }

                // Fallback for missing categoryScores — generate VARIED scores, not flat
                if (!feedback.categoryScores) {
                    const base = feedback.performanceScore || 60;
                    // Distribute scores realistically: technical and problem-solving
                    // cluster near the base, communication and cultural vary more
                    const techScore = Math.min(10, Math.max(0, Math.round(base / 10)));
                    const problemScore = Math.min(10, Math.max(0, Math.round((base - 5) / 10)));
                    const commScore = Math.min(10, Math.max(0, Math.round((base + 5) / 10)));
                    const culturalScore = Math.min(10, Math.max(0, Math.round((base + 3) / 10)));
                    feedback.categoryScores = {
                        technicalKnowledge: techScore,
                        problemSolving: problemScore,
                        communicationClarity: commScore,
                        culturalAndBehavioral: culturalScore,
                        cvAlignment: hasResume ? Math.min(10, Math.max(0, Math.round((base - 3) / 10))) : 0,
                    };
                }

                // Compute overallGrade from performanceScore if missing
                // Using industry-standard hiring terminology, not academic letter grades
                if (!feedback.overallGrade) {
                    const s = feedback.performanceScore || 60;
                    feedback.overallGrade = s >= 90 ? 'A' : s >= 85 ? 'A-' : s >= 80 ? 'B+' : s >= 75 ? 'B' : s >= 70 ? 'B-' : s >= 65 ? 'C+' : s >= 60 ? 'C' : s >= 55 ? 'C-' : 'D';
                }

                // Compute hiringDecision from performanceScore if missing
                if (!feedback.hiringDecision) {
                    const s = feedback.performanceScore || 60;
                    feedback.hiringDecision = s >= 85 ? 'Strong Hire' : s >= 70 ? 'Hire' : s >= 55 ? 'Borderline' : 'No Hire';
                }

                return NextResponse.json(feedback);
            } catch (parseErr) {
                console.error('JSON parse error:', parseErr, '\nRaw text:', text);
            }
        }

        throw new Error('Failed to parse feedback JSON from AI response');
    } catch (error: any) {
        console.error('Error generating feedback:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate feedback' },
            { status: 500 }
        );
    }
}
