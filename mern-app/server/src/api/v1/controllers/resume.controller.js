import * as resumeService from '../services/resume.service.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import asyncHandler from '../../../utils/asyncHandler.js';

export const analyze = asyncHandler(async (req, res) => {
  const { text, fileName, jobDescription } = req.body;
  const result = await resumeService.analyzeAndSave(req.user.id, {
    text,
    fileName,
    jobDescription,
  });
  return new ApiResponse(201, result, 'Resume analyzed').send(res);
});

export const getLatest = asyncHandler(async (req, res) => {
  const resume = await resumeService.getLatest(req.user.id);
  return new ApiResponse(200, { resume }).send(res);
});
