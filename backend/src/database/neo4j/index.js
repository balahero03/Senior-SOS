// backend/src/database/neo4j/index.js
// Neo4j driver singleton. One driver per process; sessions are short-lived
// and always closed.
//
// Per FOLDER_STRUCTURE.md: connection setup lives here, and services never
// construct their own driver.
//
// The graph is a derived view of PostgreSQL, which stays the system of
// record. If Neo4j is unreachable the app keeps working and graph features
// degrade rather than erroring, so a missing NEO4J_URI is not fatal.

'use strict';

const neo4j = require('neo4j-driver');
const config = require('../../config');

let driver = null;
let connected = false;

/** True when a usable driver exists. */
function isGraphEnabled() {
  return connected && driver !== null;
}

/**
 * Opens the driver and verifies connectivity.
 * Safe to call when Neo4j is not configured: it logs and returns.
 */
async function connectNeo4j() {
  if (!config.neo4j.enabled) {
    console.warn('⚠️  [neo4j] NEO4J_URI/PASSWORD not set — graph features disabled.');
    return;
  }

  try {
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
      {
        // Aura free tier is small; keep the pool modest.
        maxConnectionPoolSize: 20,
        connectionAcquisitionTimeout: 30_000,
      },
    );

    await driver.verifyConnectivity();
    connected = true;
    console.log(`🔗 [neo4j] Connected to ${config.neo4j.uri}`);
  } catch (err) {
    connected = false;
    driver = null;
    // Not fatal: PostgreSQL remains the source of truth.
    console.error(`❌ [neo4j] Connection failed (graph features disabled): ${err.message}`);
  }
}

async function disconnectNeo4j() {
  if (driver) {
    await driver.close();
    driver = null;
    connected = false;
    console.log('🔗 [neo4j] Driver closed');
  }
}

/**
 * Runs a Cypher statement in an auto-committed session.
 *
 * @param {string} cypher
 * @param {object} params
 * @param {{ write?: boolean }} opts  write:true routes to a leader in a cluster
 * @returns {Promise<object[]>} plain objects, one per record
 */
async function runQuery(cypher, params = {}, { write = false } = {}) {
  if (!isGraphEnabled()) {
    throw new Error('Neo4j is not connected');
  }

  const session = driver.session({
    database: config.neo4j.database,
    defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ,
  });

  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => normalise(record.toObject()));
  } finally {
    await session.close();
  }
}

/**
 * Converts Neo4j types into plain JSON.
 * Integers come back as {low, high} objects, and nodes/relationships carry
 * metadata the API has no use for.
 */
function normalise(value) {
  if (value === null || value === undefined) return value;

  if (neo4j.isInt(value)) {
    // Counts and degrees are far below 2^53, so a JS number is safe here.
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }

  if (Array.isArray(value)) return value.map(normalise);

  if (typeof value === 'object') {
    // Node / Relationship: expose the properties only.
    if (value.properties) return normalise(value.properties);

    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalise(v);
    return out;
  }

  return value;
}

module.exports = {
  connectNeo4j,
  disconnectNeo4j,
  runQuery,
  isGraphEnabled,
  normalise,
};
