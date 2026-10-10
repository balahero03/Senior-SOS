// backend/src/middleware/auth.middleware.js
// Authentication and role-based access middleware.
// Per FOLDER_STRUCTURE.md: middleware stays generic; business decisions in services.
// Per project.md: "JWT authentication using secure httpOnly cookies."

'use strict';

const authService = require('../modules/auth/services/auth.service');
const AppError = require('../shared/errors/AppError');

/**
 * requireAuth — verifies the JWT access token from the httpOnly cookie.
 * On success: attaches the decoded payload to req.user { sub, role }.
 * On failure: 401 via next(AppError).
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = req.cookies?.accessToken || bearerToken;

  if (!token) {
    return next(new AppError('Authentication required — no access token', 401, 'TOKEN_MISSING'));
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = payload; // { sub: userId, role, iat, exp }
    next();
  } catch (err) {
    next(err); // AppError already formatted by verifyAccessToken
  }
}

/**
 * requireRole(...roles) — checks that the authenticated user has one of the given roles.
 * Must be used after requireAuth.
 *
 * Usage:
 *   router.get('/admin', requireAuth, requireRole('ADMIN'), handler)
 *   router.post('/referrals', requireAuth, requireRole('STUDENT'), handler)
 *
 * @param {...string} roles  One or more of 'STUDENT', 'ALUMNI', 'ADMIN'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'TOKEN_MISSING'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied — required role: ${roles.join(' or ')}`,
          403,
          'FORBIDDEN',
        ),
      );
    }

    next();
  };
}

/**
 * requireAdmin — checks that the authenticated user has role ADMIN.
 * Must be used after requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'TOKEN_MISSING'));
  }

  if (req.user.role !== 'ADMIN') {
    return next(new AppError('Access denied — admin role required', 403, 'FORBIDDEN'));
  }

  next();
}

module.exports = { requireAuth, requireRole, requireAdmin };

