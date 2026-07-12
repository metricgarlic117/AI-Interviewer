import * as interviewService from '../services/interview.service.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import asyncHandler from '../../../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const interview = await interviewService.create(req.user.id, req.body.config);
  return new ApiResponse(201, { interview }, 'Interview created').send(res);
});

export const list = asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit || '20', 10);
  const interviews = await interviewService.listForUser(req.user.id, { limit });
  return new ApiResponse(200, { interviews }).send(res);
});

export const getById = asyncHandler(async (req, res) => {
  const interview = await interviewService.getById(req.user.id, req.params.id);
  return new ApiResponse(200, { interview }).send(res);
});

export const setPersona = asyncHandler(async (req, res) => {
  const interview = await interviewService.setPersona(
    req.user.id,
    req.params.id,
    req.body.interviewerPersona
  );
  return new ApiResponse(200, { interview }, 'Persona saved').send(res);
});

export const addMessage = asyncHandler(async (req, res) => {
  const { role, text, timestamp } = req.body;
  const result = await interviewService.addMessage(req.user.id, req.params.id, {
    role,
    text,
    timestamp,
  });
  return new ApiResponse(201, result, 'Message saved').send(res);
});

export const generateFeedback = asyncHandler(async (req, res) => {
  const feedback = await interviewService.generateFeedback(
    req.user.id,
    req.params.id,
    req.body.messages
  );
  return new ApiResponse(200, { feedback }, 'Feedback generated').send(res);
});
