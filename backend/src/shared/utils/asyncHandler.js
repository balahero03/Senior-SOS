// backend/src/shared/utils/asyncHandler.js
// Wraps async route handlers so uncaught promise rejections are forwarded
// to the Express error middleware instead of crashing the process.

'use strict';

/**
 * @param {Function} fn  Async Express handler (req, res, next) => Promise
 * @returns {Function}   Wrapped handler that catches errors and calls next(err)
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
