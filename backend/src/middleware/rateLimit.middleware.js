// backend/src/middleware/rateLimit.middleware.js
// Fixed-window rate limiting, backed by Redis when it is available and by an
// in-process map otherwise.
//
// Redis makes the counters shared across backend replicas. Without it each
// process counts on its own, which is weaker but still stops a single client
// hammering one instance, so the app never loses the protection when Redis is
// absent or goes down.

'use strict';

const crypto = require('crypto');
const config = require('../config');
const { getRedisClient } = require('../database/redis');

// ─── In-process fallback store ───────────────────────────────────────────────

const memory = new Map(); // key -> { count, resetAt }

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.resetAt <= now) memory.delete(key);
  }
}, 60_000);
sweeper.unref(); // never keep the process alive just to sweep

function memoryHit(key, windowMs) {
  const now = Date.now();
  let entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    memory.set(key, entry);
  }
  entry.count += 1;
  return { count: entry.count, resetInMs: entry.resetAt - now };
}

function memoryRefund(key) {
  const entry = memory.get(key);
  if (entry && entry.count > 0) entry.count -= 1;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Counts one hit against `key`. Uses Redis when connected and falls back to
 * memory if Redis is unavailable or errors, so a cache outage never turns into
 * an unprotected login endpoint or a failed request.
 */
async function hit(key, windowMs) {
  const redis = getRedisClient();
  if (redis) {
    try {
      const [[incrErr, count], [pttlErr, ttl]] = await redis
        .multi()
        .incr(key)
        .pttl(key)
        .exec();
      if (!incrErr && !pttlErr) {
        let resetInMs = ttl;
        // A brand-new key (or one that lost its expiry) has no TTL yet: start
        // the window. A refunded key that is reused keeps its running window.
        if (ttl < 0) {
          await redis.pexpire(key, windowMs);
          resetInMs = windowMs;
        }
        return { count, resetInMs };
      }
    } catch {
      // fall through to the in-process counter
    }
  }
  return memoryHit(key, windowMs);
}

async function refund(key) {
  const redis = getRedisClient();
  if (redis) {
    try {
      const value = await redis.get(key);
      if (value !== null && Number(value) > 0) await redis.decr(key);
      return;
    } catch {
      // fall through
    }
  }
  memoryRefund(key);
}

/** Short stable digest, so emails never appear in Redis keys. */
function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** Key builders for createRateLimiter. */
const keyBy = {
  ip: (req) => clientIp(req),
  // Login and password reset: one target account from one address.
  ipAndEmail: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${clientIp(req)}|${digest(email.slice(0, 254))}`;
  },
  // Authenticated routes: the signed-in user, falling back to the address.
  user: (req) => req.user?.sub || req.user?.id || clientIp(req),
};

function describeWait(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 90) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Builds a rate-limiting middleware.
 *
 * @param {object}   opts
 * @param {string}   opts.name              Identifies the limiter in the key
 * @param {number}   opts.windowSeconds     Length of the window
 * @param {number}   opts.max               Requests allowed per window
 * @param {Function} [opts.key]             (req) => string; defaults to client IP
 * @param {boolean}  [opts.skipSuccessful]  Count only failed (status >= 400) requests
 * @param {string}   [opts.message]         Prefix for the 429 message
 */
function createRateLimiter({
  name,
  windowSeconds,
  max,
  key = keyBy.ip,
  skipSuccessful = false,
  message = 'Too many requests.',
}) {
  const windowMs = windowSeconds * 1000;

  return async function rateLimit(req, res, next) {
    if (!config.rateLimit.enabled) return next();

    let storeKey;
    let result;
    try {
      storeKey = `rl:${name}:${key(req)}`;
      result = await hit(storeKey, windowMs);
    } catch (err) {
      // Never let the limiter itself break a request.
      console.error(`[rate-limit] ${name} check failed: ${err.message}`);
      return next();
    }

    const remaining = Math.max(0, max - result.count);
    const resetSeconds = Math.max(1, Math.ceil(result.resetInMs / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (result.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `${message} Please try again in ${describeWait(result.resetInMs)}.`,
          retryAfterSeconds: resetSeconds,
        },
      });
    }

    // Count failures only: give the hit back once the request succeeds.
    if (skipSuccessful) {
      res.on('finish', () => {
        if (res.statusCode < 400) refund(storeKey).catch(() => {});
      });
    }

    return next();
  };
}

// ─── Ready-made limiters ─────────────────────────────────────────────────────
// Limits are per client address unless noted. Campuses share NAT addresses, so
// the address-wide limits are deliberately much looser than the per-account ones.

const limiters = {
  // Whole-API ceiling: abuse protection, not a usage cap.
  api: createRateLimiter({
    name: 'api', windowSeconds: 60, max: 1000, key: keyBy.ip,
    message: 'Too many requests.',
  }),

  // Failed logins only: 5 per account per address, 100 per address overall.
  loginAccount: createRateLimiter({
    name: 'login-account', windowSeconds: 15 * 60, max: 5, key: keyBy.ipAndEmail,
    skipSuccessful: true, message: 'Too many failed login attempts.',
  }),
  loginAddress: createRateLimiter({
    name: 'login-ip', windowSeconds: 15 * 60, max: 100, key: keyBy.ip,
    skipSuccessful: true, message: 'Too many failed login attempts from this network.',
  }),

  register: createRateLimiter({
    name: 'register', windowSeconds: 60 * 60, max: 20, key: keyBy.ip,
    message: 'Too many sign-up attempts.',
  }),

  // Reset is verified only by department, so guessing must be expensive.
  resetAccount: createRateLimiter({
    name: 'reset-account', windowSeconds: 15 * 60, max: 5, key: keyBy.ipAndEmail,
    skipSuccessful: true, message: 'Too many failed password reset attempts.',
  }),
  resetAddress: createRateLimiter({
    name: 'reset-ip', windowSeconds: 15 * 60, max: 50, key: keyBy.ip,
    skipSuccessful: true, message: 'Too many failed password reset attempts from this network.',
  }),

  changePassword: createRateLimiter({
    name: 'change-password', windowSeconds: 15 * 60, max: 5, key: keyBy.user,
    skipSuccessful: true, message: 'Too many failed password change attempts.',
  }),

  refresh: createRateLimiter({
    name: 'refresh', windowSeconds: 15 * 60, max: 120, key: keyBy.ip,
    message: 'Too many session refresh attempts.',
  }),

  // Stops connection-request spam, which also notifies the recipient.
  connectionRequest: createRateLimiter({
    name: 'connection-request', windowSeconds: 60 * 60, max: 30, key: keyBy.user,
    message: 'You have sent a lot of connection requests.',
  }),
};

module.exports = { createRateLimiter, keyBy, limiters };
