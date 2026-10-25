// backend/src/database/redis/index.js
// Redis client singleton plus small cache helpers.
//
// Redis is an accelerator, never a source of truth: PostgreSQL, MongoDB and
// Neo4j hold the data. Every helper here fails open, so if Redis is missing or
// goes down the app keeps working and simply skips caching. A missing
// REDIS_URL disables it entirely, the same way a missing NEO4J_URI does.

'use strict';

const Redis = require('ioredis');
const config = require('../../config');

let client = null;
let ready = false;

/** True only while the connection is up and commands can run. */
function isRedisEnabled() {
  return client !== null && ready;
}

/** 'disabled' (not configured), 'up' or 'down' (configured but unreachable). */
function getRedisStatus() {
  if (!config.redis.enabled) return 'disabled';
  return isRedisEnabled() ? 'up' : 'down';
}

/** The raw ioredis client, or null when Redis is not connected. */
function getRedisClient() {
  return isRedisEnabled() ? client : null;
}

/**
 * Opens the connection. Safe to call when Redis is not configured, and never
 * throws: if the server is unreachable the client keeps retrying in the
 * background and features switch on once it comes up.
 */
async function connectRedis() {
  if (!config.redis.enabled) {
    console.warn('⚠️  [redis] REDIS_URL not set — caching and rate limiting use in-process fallbacks.');
    return;
  }

  client = new Redis(config.redis.url, {
    keyPrefix: config.redis.keyPrefix,
    lazyConnect: true,
    connectTimeout: 3_000,
    maxRetriesPerRequest: 1,
    // Fail commands immediately while disconnected instead of queueing them,
    // so a Redis outage never makes API requests hang.
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 500, 15_000),
  });

  // Log state changes, not every failed retry.
  let lastError = '';
  client.on('ready', () => {
    ready = true;
    lastError = '';
    console.log(`🧱 [redis] Connected to ${redactUrl(config.redis.url)}`);
  });
  client.on('close', () => {
    if (ready) console.warn('⚠️  [redis] Connection lost — falling back until it returns.');
    ready = false;
  });
  client.on('error', (err) => {
    // Connection failures arrive as an AggregateError with an empty message
    // (one error per address tried), so read the real cause from inside it.
    const cause = err.errors?.[0] || err;
    const message = cause.code
      ? `${cause.code}${cause.address ? ` ${cause.address}:${cause.port}` : ''}`
      : (cause.message || String(cause));
    if (message !== lastError) {
      lastError = message;
      console.error(`❌ [redis] ${message}`);
    }
  });

  try {
    await client.connect();
  } catch (err) {
    // Not fatal: ioredis keeps retrying in the background.
    console.error(`❌ [redis] Initial connection failed (continuing without it): ${err.message}`);
  }
}

async function disconnectRedis() {
  if (!client) return;
  const closing = client;
  client = null;
  ready = false;
  try {
    await closing.quit();
  } catch {
    closing.disconnect();
  }
  console.log('🧱 [redis] Connection closed');
}

/** Hides any password in a Redis URL before it is logged. */
function redactUrl(url) {
  return String(url).replace(/\/\/([^:@/]*):[^@]*@/, '//$1:***@');
}

// ─── Cache helpers (fail open) ───────────────────────────────────────────────

/** Reads a JSON value; returns null on a miss or when Redis is unavailable. */
async function cacheGet(key) {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Stores a JSON value with a time-to-live in seconds. Returns whether it was stored. */
async function cacheSet(key, value, ttlSeconds) {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.trunc(ttlSeconds)));
    return true;
  } catch {
    return false;
  }
}

/** Deletes exact keys. Returns how many were removed. */
async function cacheDel(...keys) {
  const redis = getRedisClient();
  if (!redis || keys.length === 0) return 0;
  try {
    return await redis.del(...keys);
  } catch {
    return 0;
  }
}

/**
 * Deletes every key that starts with `prefix`, using SCAN so a large keyspace
 * never blocks the server. Returns how many were removed.
 */
async function cacheDelByPrefix(prefix) {
  const redis = getRedisClient();
  if (!redis) return 0;
  try {
    // ioredis prepends keyPrefix to commands but not to SCAN's MATCH, nor does
    // it strip it from returned keys, so account for it by hand.
    const fullPrefix = config.redis.keyPrefix;
    let cursor = '0';
    let removed = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${fullPrefix}${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length) {
        removed += await redis.del(...keys.map((k) => k.slice(fullPrefix.length)));
      }
    } while (cursor !== '0');
    return removed;
  } catch {
    return 0;
  }
}

module.exports = {
  connectRedis,
  disconnectRedis,
  isRedisEnabled,
  getRedisStatus,
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelByPrefix,
};
