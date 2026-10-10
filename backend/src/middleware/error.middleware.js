// backend/src/middleware/error.middleware.js
// Centralised Express error handler. Must be the last middleware registered.
// Per FOLDER_STRUCTURE.md: centralised error handling belongs in middleware/.

'use strict';

const config = require('../config');

/**
 * Converts a Prisma known request error code to an HTTP status.
 * P2002 = unique constraint violation.
 */
function prismaStatusCode(code) {
  const map = {
    P2002: 409, // Unique constraint — duplicate
    P2025: 404, // Record not found
    P2003: 409, // Foreign key constraint
    P2014: 409, // Relation violation
  };
  return map[code] || 500;
}

/**
 * Global error handler (4 arguments — Express detects it automatically).
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  // ── AppError (operational, expected) ────────────────────────────────────
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // ── Prisma known errors ──────────────────────────────────────────────────
  if (err.code && err.code.startsWith('P2')) {
    const statusCode = prismaStatusCode(err.code);
    const message =
      err.code === 'P2002'
        ? 'A record with this value already exists'
        : err.message;

    return res.status(statusCode).json({
      success: false,
      error: {
        code: `PRISMA_${err.code}`,
        message,
      },
    });
  }

  // ── Zod validation errors (should be caught in controller, but as safety net) ──
  if (err.name === 'ZodError') {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: err.issues,
      },
    });
  }

  // ── Programming errors — log and return generic message ─────────────────
  console.error('[error]', {
    message: err.message,
    stack: config.isDevelopment ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDevelopment
        ? err.message
        : 'An unexpected error occurred',
    },
  });
}

module.exports = errorMiddleware;
