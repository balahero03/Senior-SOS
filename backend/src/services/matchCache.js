// backend/src/services/matchCache.js
// Short-lived Redis cache for the recommendation endpoints (best-fit alumni and
// peers). Each call loads hundreds of candidates and queries Neo4j, which is
// the slowest read in the app and is repeated by the dashboard card, /connect
// and Best Fit.
//
// Correctness rules, in order of importance:
//   1. Never serve one person's results to another. The key starts with the
//      viewer's id.
//   2. Privacy must take effect immediately. A visibility change, suspension or
//      verification change clears EVERY cached result (invalidateAll).
//   3. A person's own actions refresh their view immediately: connecting,
//      accepting, rejecting, cancelling or editing their profile clears the
//      affected users' entries (invalidateUsers).
//   Anything else (someone else editing their profile, a new sign-up) is
//   picked up when the entry expires after TTL_SECONDS.
//
// Redis being unavailable just means every call is computed fresh.

'use strict';

const crypto = require('crypto');
const { cacheGet, cacheSet, cacheDelByPrefix } = require('../database/redis');

const TTL_SECONDS = 180;
const MAX_CACHED_INTEREST_LENGTH = 100;

// Keys look like match:<viewerId>:<kind>:<filterHash>, so one prefix clears one
// viewer and the bare 'match:' prefix clears everyone.
const ROOT = 'match:';

/** Stable digest of the filters that shape a result. */
function filterHash(params) {
  const normal = {
    limit: params.limit ?? null,
    role: params.role ?? null,
    skillId: params.skillId ?? null,
    departmentId: params.departmentId ?? null,
    companyId: params.companyId ?? null,
    interest: params.interest ? String(params.interest).trim().toLowerCase() : null,
  };
  return crypto.createHash('sha1').update(JSON.stringify(normal)).digest('hex').slice(0, 16);
}

/**
 * Returns { value, source } with source HIT, MISS or BYPASS (not stored).
 *
 * @param {string}   viewerId
 * @param {string}   kind     'alumni' | 'peers'
 * @param {object}   params   filters; part of the key
 * @param {Function} compute  async () => result, run on a miss
 */
async function withMatchCache(viewerId, kind, params, compute) {
  const cacheable = !params.interest || String(params.interest).length <= MAX_CACHED_INTEREST_LENGTH;
  const key = `${ROOT}${viewerId}:${kind}:${filterHash(params)}`;

  if (cacheable) {
    const hit = await cacheGet(key);
    if (hit !== null) return { value: hit, source: 'HIT' };
  }

  const value = await compute();
  const stored = cacheable ? await cacheSet(key, value, TTL_SECONDS) : false;
  return { value, source: stored ? 'MISS' : 'BYPASS' };
}

/** Clears every cached recommendation for the given users (as viewer). */
async function invalidateUsers(...userIds) {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(unique.map((id) => cacheDelByPrefix(`${ROOT}${id}:`)));
}

/** Clears every cached recommendation for everyone. */
function invalidateAll() {
  return cacheDelByPrefix(ROOT);
}

module.exports = { withMatchCache, invalidateUsers, invalidateAll, TTL_SECONDS };
