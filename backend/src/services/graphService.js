// backend/src/services/graphService.js
// Graph queries over the Neo4j mirror of the connection network.
//
// Model:
//   (:User { id, name, role, department, graduationYear, company, designation })
//   (:User)-[:CONNECTED_TO { since }]->(:User)
//
// CONNECTED_TO is written in both directions so traversals stay symmetric
// without Cypher having to ignore direction on every query. PostgreSQL holds
// one canonical row per pair; the mirror holds two relationships.

'use strict';

const { runQuery, isGraphEnabled } = require('../database/neo4j');

// ─── Schema ──────────────────────────────────────────────────────────────────

/** Constraints and indexes. Safe to run repeatedly. */
async function ensureSchema() {
  await runQuery(
    'CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
    {}, { write: true },
  );
  // Company and department lookups drive "who do we know at X".
  await runQuery(
    'CREATE INDEX user_company IF NOT EXISTS FOR (u:User) ON (u.company)',
    {}, { write: true },
  );
  await runQuery(
    'CREATE INDEX user_department IF NOT EXISTS FOR (u:User) ON (u.department)',
    {}, { write: true },
  );
  await runQuery(
    'CREATE INDEX user_role IF NOT EXISTS FOR (u:User) ON (u.role)',
    {}, { write: true },
  );
}

// ─── Writes (kept in step with PostgreSQL) ──────────────────────────────────

/** Creates or updates one user node. */
async function upsertUser(user) {
  await runQuery(
    `MERGE (u:User { id: $id })
     SET u.name = $name,
         u.role = $role,
         u.department = $department,
         u.graduationYear = $graduationYear,
         u.company = $company,
         u.designation = $designation,
         u.updatedAt = datetime()`,
    {
      id: user.id,
      name: user.name ?? null,
      role: user.role ?? null,
      department: user.department ?? null,
      graduationYear: user.graduationYear ?? null,
      company: user.company ?? null,
      designation: user.designation ?? null,
    },
    { write: true },
  );
}

/** Bulk upsert, used by the sync script. */
async function upsertUsers(users) {
  if (!users.length) return;
  await runQuery(
    `UNWIND $users AS row
     MERGE (u:User { id: row.id })
     SET u.name = row.name,
         u.role = row.role,
         u.department = row.department,
         u.graduationYear = row.graduationYear,
         u.company = row.company,
         u.designation = row.designation,
         u.updatedAt = datetime()`,
    { users },
    { write: true },
  );
}

/** Mirrors one accepted connection, in both directions. */
async function addConnection(userA, userB, since = null) {
  await runQuery(
    `MATCH (a:User { id: $userA }), (b:User { id: $userB })
     MERGE (a)-[r1:CONNECTED_TO]->(b)
       ON CREATE SET r1.since = coalesce($since, datetime())
     MERGE (b)-[r2:CONNECTED_TO]->(a)
       ON CREATE SET r2.since = coalesce($since, datetime())`,
    { userA, userB, since },
    { write: true },
  );
}

/** Bulk connection mirror, used by the sync script. */
async function addConnections(pairs) {
  if (!pairs.length) return;
  await runQuery(
    `UNWIND $pairs AS row
     MATCH (a:User { id: row.userA }), (b:User { id: row.userB })
     MERGE (a)-[r1:CONNECTED_TO]->(b)
       ON CREATE SET r1.since = row.since
     MERGE (b)-[r2:CONNECTED_TO]->(a)
       ON CREATE SET r2.since = row.since`,
    { pairs },
    { write: true },
  );
}

/** Removes a connection in both directions. */
async function removeConnection(userA, userB) {
  await runQuery(
    `MATCH (a:User { id: $userA })-[r:CONNECTED_TO]-(b:User { id: $userB })
     DELETE r`,
    { userA, userB },
    { write: true },
  );
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * People connected to both users.
 * "You both know Arun, Karthik and Divya."
 */
async function getMutualConnections(userId, otherId, limit = 50) {
  const rows = await runQuery(
    `MATCH (me:User { id: $userId })-[:CONNECTED_TO]-(mutual:User)-[:CONNECTED_TO]-(them:User { id: $otherId })
     WHERE mutual.id <> $userId AND mutual.id <> $otherId
     RETURN DISTINCT mutual { .id, .name, .role, .department, .company, .designation } AS user
     ORDER BY user.name
     LIMIT toInteger($limit)`,
    { userId, otherId, limit },
  );
  return rows.map((r) => r.user);
}

/** Mutual counts for many candidates at once, for list views. */
async function getMutualCounts(userId, candidateIds) {
  if (!candidateIds.length) return {};
  const rows = await runQuery(
    `MATCH (me:User { id: $userId })-[:CONNECTED_TO]-(mutual:User)-[:CONNECTED_TO]-(other:User)
     WHERE other.id IN $candidateIds AND mutual.id <> $userId AND mutual.id <> other.id
     RETURN other.id AS id, count(DISTINCT mutual) AS mutualCount`,
    { userId, candidateIds },
  );
  const out = {};
  for (const row of rows) out[row.id] = row.mutualCount;
  return out;
}

/**
 * Shortest path between two people.
 * Returns the chain of users and the degree of separation, which is what
 * "Bala → Arun Kumar → Priya Sharma, 2 degrees" is built from.
 */
async function getShortestPath(userId, otherId, maxHops = 6) {
  if (userId === otherId) {
    return { found: true, degrees: 0, path: [] };
  }

  // maxHops is interpolated because Cypher does not allow a parameter in a
  // variable-length pattern. It is clamped to an integer by the caller and
  // again here, so it can never carry arbitrary text into the query.
  const hops = Math.max(1, Math.min(10, Math.trunc(Number(maxHops) || 6)));

  const rows = await runQuery(
    `MATCH (a:User { id: $userId }), (b:User { id: $otherId })
     MATCH p = shortestPath((a)-[:CONNECTED_TO*1..${hops}]-(b))
     RETURN [n IN nodes(p) | n { .id, .name, .role, .department, .company, .designation }] AS nodes,
            length(p) AS degrees`,
    { userId, otherId },
  );

  if (!rows.length) return { found: false, degrees: null, path: [] };
  return { found: true, degrees: rows[0].degrees, path: rows[0].nodes };
}

/**
 * Suggested connections: people within two hops, ranked by how many
 * connections you share. This is the "people you may know" query.
 */
async function getSuggestions(userId, { limit = 20, role = null } = {}) {
  const rows = await runQuery(
    `MATCH (me:User { id: $userId })-[:CONNECTED_TO]-(mutual:User)-[:CONNECTED_TO]-(candidate:User)
     WHERE candidate.id <> $userId
       AND NOT (me)-[:CONNECTED_TO]-(candidate)
       AND ($role IS NULL OR candidate.role = $role)
     WITH candidate, count(DISTINCT mutual) AS mutualCount,
          collect(DISTINCT mutual.name)[0..3] AS viaNames
     RETURN candidate { .id, .name, .role, .department, .graduationYear, .company, .designation } AS user,
            mutualCount, viaNames
     ORDER BY mutualCount DESC, user.name
     LIMIT toInteger($limit)`,
    { userId, limit, role },
  );
  return rows;
}

/**
 * Alumni at a company reachable through your network, with the path length.
 * Answers "does anyone from our college work at Amazon, and how do I reach
 * them?" — the question project.md opens with.
 */
async function getReachableAtCompany(userId, company, { maxHops = 4, limit = 25 } = {}) {
  const hops = Math.max(1, Math.min(6, Math.trunc(Number(maxHops) || 4)));

  const rows = await runQuery(
    `MATCH (me:User { id: $userId })
     MATCH (target:User)
     WHERE target.id <> $userId
       AND toLower(target.company) CONTAINS toLower($company)
     MATCH p = shortestPath((me)-[:CONNECTED_TO*1..${hops}]-(target))
     RETURN target { .id, .name, .role, .department, .company, .designation } AS user,
            length(p) AS degrees,
            [n IN nodes(p) | n.name] AS via
     ORDER BY degrees, user.name
     LIMIT toInteger($limit)`,
    { userId, company, limit },
  );
  return rows;
}

/**
 * The subgraph around one user, for the /network/graph visual page.
 * Returns nodes and edges ready for a force-directed layout.
 */
async function getNetworkGraph(userId, { depth = 2, limit = 120 } = {}) {
  const hops = Math.max(1, Math.min(3, Math.trunc(Number(depth) || 2)));

  const rows = await runQuery(
    `MATCH (me:User { id: $userId })
     CALL {
       WITH me
       MATCH p = (me)-[:CONNECTED_TO*1..${hops}]-(other:User)
       RETURN collect(DISTINCT other) AS others
     }
     WITH me, others[0..toInteger($limit)] AS others
     WITH [me] + others AS people
     UNWIND people AS person
     WITH people, collect(person { .id, .name, .role, .department, .graduationYear, .company, .designation }) AS nodes
     UNWIND people AS a
     UNWIND people AS b
     WITH nodes, a, b
     WHERE a.id < b.id AND (a)-[:CONNECTED_TO]-(b)
     RETURN nodes, collect({ source: a.id, target: b.id }) AS edges`,
    { userId, limit },
  );

  if (!rows.length) return { nodes: [], edges: [] };
  return { nodes: rows[0].nodes || [], edges: rows[0].edges || [] };
}

/**
 * The campus-wide graph, independent of any one viewer.
 *
 * Takes the best-connected people first so the sample is the structural core
 * of the network rather than an arbitrary slice, then returns every edge
 * between them. This is what an administrator needs: the shape of the whole
 * network, not one person's neighbourhood.
 */
async function getCampusGraph({ limit = 150, role = null, department = null, company = null } = {}) {
  const rows = await runQuery(
    `MATCH (u:User)
     WHERE ($role IS NULL OR u.role = $role)
       AND ($department IS NULL OR u.department = $department)
       AND ($company IS NULL OR toLower(u.company) CONTAINS toLower($company))
     OPTIONAL MATCH (u)-[:CONNECTED_TO]->(other:User)
     WITH u, count(other) AS degree
     ORDER BY degree DESC
     LIMIT toInteger($limit)
     WITH collect(u) AS people, collect({ id: u.id, degree: degree }) AS degrees
     UNWIND people AS a
     UNWIND people AS b
     WITH people, degrees, a, b
     WHERE a.id < b.id AND (a)-[:CONNECTED_TO]-(b)
     WITH people, degrees, collect({ source: a.id, target: b.id }) AS edges
     RETURN [p IN people | p { .id, .name, .role, .department, .graduationYear, .company, .designation }] AS nodes,
            edges, degrees`,
    { limit, role, department, company },
  );

  if (!rows.length) return { nodes: [], edges: [], degrees: {} };

  const degrees = {};
  for (const d of rows[0].degrees || []) degrees[d.id] = d.degree;
  return { nodes: rows[0].nodes || [], edges: rows[0].edges || [], degrees };
}

/**
 * Shortest path between any two people, for administrators inspecting the
 * network. Same query as getShortestPath but without assuming the requester
 * is one of the endpoints.
 */
async function getPathBetween(fromId, toId, maxHops = 6) {
  if (fromId === toId) return { found: true, degrees: 0, path: [] };
  const hops = Math.max(1, Math.min(10, Math.trunc(Number(maxHops) || 6)));

  const rows = await runQuery(
    `MATCH (a:User { id: $fromId }), (b:User { id: $toId })
     MATCH p = shortestPath((a)-[:CONNECTED_TO*1..${hops}]-(b))
     RETURN [n IN nodes(p) | n { .id, .name, .role, .department, .company, .designation }] AS nodes,
            length(p) AS degrees`,
    { fromId, toId },
  );

  if (!rows.length) return { found: false, degrees: null, path: [] };
  return { found: true, degrees: rows[0].degrees, path: rows[0].nodes };
}

/** The most connected people on campus, for an admin overview. */
async function getTopConnectors(limit = 10) {
  return runQuery(
    `MATCH (u:User)-[:CONNECTED_TO]->(other:User)
     WITH u, count(DISTINCT other) AS degree
     ORDER BY degree DESC
     LIMIT toInteger($limit)
     RETURN u { .id, .name, .role, .department, .company, .designation } AS user, degree`,
    { limit },
  );
}

/** Find people by name, so an admin can centre the graph on someone. */
async function searchUsers(query, limit = 10) {
  return runQuery(
    `MATCH (u:User)
     WHERE toLower(u.name) CONTAINS toLower($query)
     OPTIONAL MATCH (u)-[:CONNECTED_TO]->(other:User)
     WITH u, count(other) AS degree
     RETURN u { .id, .name, .role, .department, .graduationYear, .company, .designation } AS user, degree
     ORDER BY degree DESC, user.name
     LIMIT toInteger($limit)`,
    { query, limit },
  );
}

/** Degree (connection count) for one user, straight from the graph. */
async function getDegree(userId) {
  const rows = await runQuery(
    `MATCH (u:User { id: $userId })-[:CONNECTED_TO]->(other:User)
     RETURN count(DISTINCT other) AS degree`,
    { userId },
  );
  return rows.length ? rows[0].degree : 0;
}

/** Node and relationship counts, for the sync script and admin stats. */
async function getGraphStats() {
  const rows = await runQuery(
    `MATCH (u:User)
     WITH count(u) AS users
     OPTIONAL MATCH ()-[r:CONNECTED_TO]->()
     RETURN users, count(r) AS relationships`,
  );
  const row = rows[0] || { users: 0, relationships: 0 };
  return {
    users: row.users,
    // Stored in both directions, so halve for the real connection count.
    connections: Math.floor((row.relationships || 0) / 2),
  };
}

module.exports = {
  isGraphEnabled,
  getCampusGraph,
  getPathBetween,
  getTopConnectors,
  searchUsers,
  ensureSchema,
  upsertUser,
  upsertUsers,
  addConnection,
  addConnections,
  removeConnection,
  getMutualConnections,
  getMutualCounts,
  getShortestPath,
  getSuggestions,
  getReachableAtCompany,
  getNetworkGraph,
  getDegree,
  getGraphStats,
};
