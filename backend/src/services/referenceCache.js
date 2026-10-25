// backend/src/services/referenceCache.js
// Redis cache for reference data that is read on nearly every page and changes
// rarely: skills, departments and companies.
//
// PostgreSQL stays the source of truth. A cache miss, or Redis being down,
// simply reads the database exactly as before. Entries expire after a few
// minutes and are also cleared by invalidate*() at every place that creates
// one, so a new department or company shows up straight away.

'use strict';

const { prisma } = require('../database/postgres');
const { cacheGet, cacheSet, cacheDelByPrefix } = require('../database/redis');

const TTL_SECONDS = 300;

const KEYS = {
  skills: 'ref:skills',
  departments: 'ref:departments',
  companies: 'ref:companies', // one entry per search term: ref:companies:<q>
};

// Company searches are free text, so only cache short terms: a flood of random
// searches must not be able to fill the cache with one-off entries.
const MAX_CACHED_SEARCH_LENGTH = 40;

/**
 * Returns { value, source } where source is:
 *   HIT    served from Redis
 *   MISS   loaded from PostgreSQL and stored
 *   BYPASS loaded from PostgreSQL, not stored (Redis unavailable or term too long)
 */
async function cached(key, loader, { cacheable = true } = {}) {
  if (cacheable) {
    const hit = await cacheGet(key);
    if (hit !== null) return { value: hit, source: 'HIT' };
  }
  const value = await loader();
  const stored = cacheable ? await cacheSet(key, value, TTL_SECONDS) : false;
  return { value, source: stored ? 'MISS' : 'BYPASS' };
}

/** Every skill as { id, name }, sorted by name. Search ranks this list in memory. */
function getSkillList() {
  return cached(KEYS.skills, () => prisma.skill.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  }));
}

/** Every department as { id, code, name }, sorted by code. */
function getDepartmentList() {
  return cached(KEYS.departments, () => prisma.department.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  }));
}

/** Companies as { id, name, nameKey }, optionally filtered by name; at most 50. */
function getCompanyList(search = '') {
  const term = String(search || '').trim().toLowerCase();
  const where = term ? { nameKey: { contains: term } } : {};
  return cached(
    `${KEYS.companies}:${encodeURIComponent(term)}`,
    () => prisma.company.findMany({
      where,
      select: { id: true, name: true, nameKey: true },
      orderBy: { name: 'asc' },
      take: 50,
    }),
    { cacheable: term.length <= MAX_CACHED_SEARCH_LENGTH },
  );
}

// ─── Invalidation: call after creating or changing a row ─────────────────────
// Each is safe to fire and forget: cacheDelByPrefix never throws.

const invalidateSkills = () => cacheDelByPrefix(KEYS.skills);
const invalidateDepartments = () => cacheDelByPrefix(KEYS.departments);
const invalidateCompanies = () => cacheDelByPrefix(KEYS.companies);

module.exports = {
  getSkillList,
  getDepartmentList,
  getCompanyList,
  invalidateSkills,
  invalidateDepartments,
  invalidateCompanies,
  TTL_SECONDS,
};
