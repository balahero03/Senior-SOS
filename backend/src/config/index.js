// backend/src/config/index.js
// Reads and validates all environment variables at startup.
// The application fails fast with a clear message if required values are missing.
// Never hard-code secrets here — they must come from .env / environment.

'use strict';

require('dotenv').config();

/**
 * Asserts that a required environment variable is set and non-empty.
 * @param {string} name
 * @returns {string}
 */
function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value.trim();
}

/**
 * Returns an optional environment variable or a default.
 * @param {string} name
 * @param {string} defaultValue
 * @returns {string}
 */
function optional(name, defaultValue) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),

  database: {
    // Full Prisma connection string — required
    url: required('DATABASE_URL'),
  },

  mongodb: {
    // MongoDB connection URI — optional during phase 1 (auth-only), required for community/messages
    uri: optional('MONGODB_URI', ''),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
    // Refresh token TTL in milliseconds (for DB expires_at calculation)
    refreshTtlMs: parseInt(optional('REFRESH_TOKEN_TTL_MS', String(7 * 24 * 60 * 60 * 1000)), 10),
  },

  cookie: {
    // Use true in production (HTTPS only)
    secure: optional('COOKIE_SECURE', 'false') === 'true',
    domain: optional('COOKIE_DOMAIN', 'localhost'),
    // SameSite policy — 'strict' is most secure for same-origin APIs
    sameSite: optional('COOKIE_SAME_SITE', 'strict'),
  },

  cors: {
    // The React dev server origin
    clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),
  },

  neo4j: {
    // Neo4j Aura connection. Empty uri disables all graph features, so the
    // app still runs without it.
    uri: optional('NEO4J_URI', ''),
    // No 'neo4j' default for user/database: on AuraDB Free both are the
    // instance id, and defaulting to 'neo4j' turns a misconfiguration into
    // an auth error or "database does not exist" that reads like a bad
    // password. Empty values fail the enabled check instead.
    user: optional('NEO4J_USER', ''),
    password: optional('NEO4J_PASSWORD', ''),
    database: optional('NEO4J_DATABASE', ''),
    get enabled() {
      return Boolean(this.uri && this.user && this.password && this.database);
    },
  },

  redis: {
    // Cache, rate limiting and realtime coordination. Empty url disables Redis
    // entirely and the app runs without it, exactly as it does without Neo4j.
    url: optional('REDIS_URL', ''),
    // Prefix for every key, so the instance can be shared safely.
    keyPrefix: optional('REDIS_KEY_PREFIX', 'sos:'),
    get enabled() {
      return Boolean(this.url);
    },
  },

  rateLimit: {
    // Set RATE_LIMIT_DISABLED=true to turn limiting off (the test suite does).
    enabled: optional('RATE_LIMIT_DISABLED', 'false') !== 'true',
    // Number of reverse proxies (ingress, load balancer) in front of the app, so
    // the real client address is used instead of the proxy's. 0 = none.
    trustProxy: parseInt(optional('TRUST_PROXY', '0'), 10) || 0,
  },

  transcriptLog: {
    // Full request/response transcript to logs/api-<date>.txt.
    // Records bodies verbatim, including passwords and tokens, so it is
    // opt-in and refuses to run in production.
    enabled:
      optional('API_TRANSCRIPT_LOG', 'false') === 'true'
      && optional('NODE_ENV', 'development') !== 'production',
  },

  isProduction: optional('NODE_ENV', 'development') === 'production',
  isDevelopment: optional('NODE_ENV', 'development') === 'development',
};

module.exports = config;
