import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: NextRequest) {
    try {
        const { base64Image, mimeType } = await request.json();

        if (!base64Image || !mimeType) {
            return NextResponse.json(
                { error: 'Image data and mime type are required' },
                { status: 400 }
            );
        }

        const prompt = "Extract all text from this image. Return only the text content, nothing else.";

        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: base64Image,
                                mimeType: mimeType
                            }
                        }
                    ]
                }
            ]
        });

        const text = result.text || '';
        return NextResponse.json({ text });
    } catch (error: any) {
        console.error('Error extracting text from image:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to extract text' },
            { status: 500 }
        );
    }
}
