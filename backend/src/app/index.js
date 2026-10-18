// backend/src/app/index.js
// Creates and configures the Express application.
// Per FOLDER_STRUCTURE.md §backend/src/app/:
//   "Creates and configures the Express application: middleware registration,
//    API router mounting, health endpoint, and error-handling setup."
// Process startup (listen) belongs in server.js.

'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

const express = require('express');

const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('../config');
const errorMiddleware = require('../middleware/error.middleware');
const requestLogger = require('../middleware/requestLogger.middleware');
const authRoutes = require('../modules/auth/routes/auth.routes');
const postRoutes = require('../routes/postRoutes');
const connectionRoutes = require('../routes/connectionRoutes');
const mentorshipRoutes = require('../routes/mentorshipRoutes');
const communityRoutes = require('../modules/community/routes/community.routes');
const messagesRoutes = require('../modules/messages/routes/messages.routes');
const userRoutes = require('../routes/userRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const adminRoutes = require('../routes/adminRoutes');
const settingsRoutes = require('../routes/settingsRoutes');
const graphRoutes = require('../routes/graphRoutes');
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth.middleware');

// ─── Create app ───────────────────────────────────────────────────────────────

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────

app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Credentials must be true so the browser sends cookies cross-origin in development.

app.use(
  cors({
    origin: config.cors.clientOrigin,
    credentials: true,              // Required for httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Request parsing ──────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Request logging ──────────────────────────────────────────────────────────

if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Full request/response transcript to logs/api-<date>.txt. Registered after
// the body and cookie parsers so it can read both, and before the routes so
// it wraps every API response. Off unless API_TRANSCRIPT_LOG is enabled,
// because it records bodies verbatim.
if (config.transcriptLog.enabled) {
  app.use(requestLogger);
}

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
// Mount each module router under /api/<module>.

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// app.get, not app.use: app.use matches every method, so a POST or DELETE to
// these paths would run the read handler and return 200 with the list.
//
// Departments stay public: the register and forgot-password forms need the
// real department UUIDs before the user has a token, and registering with a
// guessed code instead of a UUID fails validation.
app.get('/api/departments', userController.getDepartments);
app.get('/api/companies', requireAuth, userController.getCompanies);
app.get('/api/skills', requireAuth, userController.getSkills);
app.use('/api/posts', postRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/mentorship', mentorshipRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api', communityRoutes);      // /api/posts fallback, other community routes
app.use('/api', messagesRoutes);       // /api/conversations, /api/messages

// ─── 404 for unmatched API routes ────────────────────────────────────────────

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// ─── Central error handler (must be last) ────────────────────────────────────

app.use(errorMiddleware);

module.exports = app;
