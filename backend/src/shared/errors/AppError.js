// backend/src/shared/errors/AppError.js
// Typed application error used across all modules.
// Controllers catch this and the error middleware turns it into an HTTP response.

'use strict';

class AppError extends Error {
  /**
   * @param {string} message   Human-readable message (not exposed raw to clients in production)
   * @param {number} statusCode  HTTP status code
   * @param {string} [code]     Machine-readable error code (e.g. 'EMAIL_TAKEN')
   */
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode || 500;
    this.code = code || 'INTERNAL_ERROR';
    this.isOperational = true; // Distinguishes expected errors from programming bugs

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

module.exports = AppError;
