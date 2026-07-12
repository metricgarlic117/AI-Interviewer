import env from '../../../config/env.js';
import * as authService from '../services/auth.service.js';
import { ttlToSeconds } from '../services/auth.service.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import { COOKIES } from '../../../constants/index.js';

/**
 * The refresh token travels only as an httpOnly cookie scoped to the auth
 * routes, so XSS cannot read it and it is never sent to other endpoints.
 */
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: ttlToSeconds(env.REFRESH_TOKEN_TTL) * 1000,
});

function requestMeta(req) {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, tokens } = await authService.register(
    { name, email, password },
    requestMeta(req)
  );

  res.cookie(COOKIES.REFRESH_TOKEN, tokens.refreshToken, refreshCookieOptions());
  return new ApiResponse(
    201,
    { user, accessToken: tokens.accessToken },
    'Account created'
  ).send(res);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, tokens } = await authService.login(
    { email, password },
    requestMeta(req)
  );

  res.cookie(COOKIES.REFRESH_TOKEN, tokens.refreshToken, refreshCookieOptions());
  return new ApiResponse(
    200,
    { user, accessToken: tokens.accessToken },
    'Logged in'
  ).send(res);
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.refresh(
    req.cookies?.[COOKIES.REFRESH_TOKEN],
    requestMeta(req)
  );

  res.cookie(COOKIES.REFRESH_TOKEN, tokens.refreshToken, refreshCookieOptions());
  return new ApiResponse(
    200,
    { user, accessToken: tokens.accessToken },
    'Session refreshed'
  ).send(res);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout({
    accessJti: req.user.jti,
    accessExp: req.user.exp,
    refreshTokenValue: req.cookies?.[COOKIES.REFRESH_TOKEN],
  });

  res.clearCookie(COOKIES.REFRESH_TOKEN, { path: '/api/v1/auth' });
  return new ApiResponse(200, null, 'Logged out').send(res);
});

export const logoutAll = asyncHandler(async (req, res) => {
  await authService.revokeAllSessions(req.user.id);
  await authService.logout({
    accessJti: req.user.jti,
    accessExp: req.user.exp,
    refreshTokenValue: req.cookies?.[COOKIES.REFRESH_TOKEN],
  });

  res.clearCookie(COOKIES.REFRESH_TOKEN, { path: '/api/v1/auth' });
  return new ApiResponse(200, null, 'Logged out of all sessions').send(res);
});
