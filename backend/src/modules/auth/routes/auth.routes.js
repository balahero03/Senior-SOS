// backend/src/modules/auth/routes/auth.routes.js
// HTTP paths for the auth module.
// Per FOLDER_STRUCTURE.md: routes map HTTP paths to controllers only.
// Business rules are in auth.service; persistence is in auth.repository.

'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../../../middleware/auth.middleware');
const { limiters } = require('../../../middleware/rateLimit.middleware');

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', limiters.register, authController.register);

// POST /api/auth/login
// Counts failed attempts only, per account and per address.
router.post('/login', limiters.loginAddress, limiters.loginAccount, authController.login);

// POST /api/auth/logout
// Best effort — does not require authentication (allows clearing stale cookies)
router.post('/logout', authController.logout);

// POST /api/auth/refresh
// Uses the httpOnly refresh token cookie; issues new access + refresh tokens
router.post('/refresh', limiters.refresh, authController.refresh);

// POST /api/auth/reset-password
// Forgot password via email + department verification
router.post('/reset-password', limiters.resetAddress, limiters.resetAccount, authController.resetPassword);


// ─── Protected routes ─────────────────────────────────────────────────────────

// GET /api/auth/me
// Requires a valid access token cookie
router.get('/me', requireAuth, authController.me);

// POST /api/auth/change-password
// Requires a valid access token cookie
router.post('/change-password', requireAuth, limiters.changePassword, authController.changePassword);

module.exports = router;
