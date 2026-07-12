import * as aiService from '../services/ai.service.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import asyncHandler from '../../../utils/asyncHandler.js';

export const geminiLiveToken = asyncHandler(async (_req, res) => {
  const token = await aiService.createGeminiLiveToken();
  return new ApiResponse(200, { token }).send(res);
});

export const assemblyAiToken = asyncHandler(async (_req, res) => {
  const token = await aiService.createAssemblyAiToken();
  return new ApiResponse(200, { token }).send(res);
});

export const extractText = asyncHandler(async (req, res) => {
  const { base64Image, mimeType } = req.body;
  const text = await aiService.extractTextFromImage(base64Image, mimeType);
  return new ApiResponse(200, { text }).send(res);
});
