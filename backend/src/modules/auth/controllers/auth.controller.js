// backend/src/modules/auth/controllers/auth.controller.js
// Translates HTTP request/response to service calls.
// Contains NO business rules — those live in auth.service.js.
// Sets httpOnly cookies; never returns the raw refresh token in the body.

'use strict';

const authService = require('../services/auth.service');
const { registerSchema, loginSchema, validate } = require('../validators/auth.validator');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const config = require('../../../config');

// ─── Cookie helper ────────────────────────────────────────────────────────────

/**
 * Returns the standard httpOnly cookie options per project.md §5 auth rules:
 * "JWT authentication using secure httpOnly cookies; access and refresh token
 *  rather than a long-lived token in localStorage."
 */
function refreshCookieOptions() {
  return {
    httpOnly: true,                       // Not accessible via JS
    secure: config.cookie.secure,         // HTTPS only in production
    sameSite: config.cookie.sameSite,     // CSRF protection
    maxAge: config.jwt.refreshTtlMs,      // Matches DB expires_at
    path: '/api/auth',                    // Scope cookie to auth endpoints only
  };
}

function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: 15 * 60 * 1000,              // 15 minutes — matches JWT exp
    path: '/',
  };
}

function clearCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { name, email, password, confirmPassword, role, departmentId,
 *         graduationYear, bio?, careerInterests?, company?, designation?,
 *         experienceYears? }
 */
const register = asyncHandler(async (req, res) => {
  const { success, data, errors } = validate(registerSchema, req.body);
  if (!success) {
    return res.status(422).json({ success: false, errors });
  }

  const { user, accessToken, rawRefreshToken } = await authService.register(data);

  res
    .cookie('accessToken', accessToken, accessCookieOptions())
    .cookie('refreshToken', rawRefreshToken, refreshCookieOptions())
    .status(201)
    .json({
      success: true,
      message: 'Account created successfully',
      data: { user },
    });
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = asyncHandler(async (req, res) => {
  const { success, data, errors } = validate(loginSchema, req.body);
  if (!success) {
    return res.status(422).json({ success: false, errors });
  }

  const { user, accessToken, rawRefreshToken } = await authService.login(data);

  res
    .cookie('accessToken', accessToken, accessCookieOptions())
    .cookie('refreshToken', rawRefreshToken, refreshCookieOptions())
    .status(200)
    .json({
      success: true,
      message: 'Logged in successfully',
      data: { user },
    });
});

/**
 * POST /api/auth/logout
 * Revokes the current refresh token and clears cookies.
 */
const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;
  await authService.logout(rawRefreshToken);
  clearCookies(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/auth/refresh
 * Uses the refresh token cookie to issue a new access token.
 * Implements token rotation (old refresh token is revoked).
 */
const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;
  const { user, accessToken, rawRefreshToken: newRawRefreshToken } =
    await authService.refreshTokens(rawRefreshToken);

  res
    .cookie('accessToken', accessToken, accessCookieOptions())
    .cookie('refreshToken', newRawRefreshToken, refreshCookieOptions())
    .status(200)
    .json({
      success: true,
      message: 'Tokens refreshed',
      data: { user },
    });
});

/**
 * GET /api/auth/me
 * Returns the authenticated user (req.user set by auth.middleware).
 */
const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.sub);
  res.status(200).json({ success: true, data: { user } });
});

module.exports = { register, login, logout, refresh, me };
