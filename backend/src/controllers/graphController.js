// backend/src/controllers/graphController.js
// Graph endpoints: mutual connections, shortest paths, suggestions and the
// network subgraph behind /network/graph.
//
// Every handler degrades rather than failing when Neo4j is unavailable, so
// the rest of the app keeps working if the graph is down or unconfigured.

'use strict';

const graph = require('../services/graphService');
const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');
const { getHiddenUserIds } = require('../services/visibilityService');

const requesterId = (req) => req.user.sub || req.user.id;
const requesterRole = (req) => req.user.role;

// Label shown in place of someone who is CONNECTIONS_ONLY. Keeping the hop
// in the path preserves the distance, which is not itself private; only the
// identity is withheld.
const REDACTED_NODE = { id: null, name: 'A shared connection', redacted: true };

/**
 * Replaces hidden people in a path with an anonymous placeholder.
 * The endpoints are left alone: the requester is one of them, and the other
 * is someone they explicitly asked about and is checked separately.
 */
function redactPath(path, hidden) {
  if (!hidden.size) return path;
  return (path || []).map((node, i) => (
    i > 0 && i < path.length - 1 && hidden.has(node.id) ? REDACTED_NODE : node
  ));
}

function assertGraph() {
  if (!graph.isGraphEnabled()) {
    throw new AppError(
      'Graph features are unavailable. Set NEO4J_URI and NEO4J_PASSWORD in backend/.env, then run: npm run graph:sync',
      503,
      'GRAPH_UNAVAILABLE',
    );
  }
}

/**
 * GET /api/graph/status
 * Whether graph features are usable, and what the graph currently holds.
 * Deliberately does not throw, so the UI can ask before offering the page.
 */
const getStatus = asyncHandler(async (req, res) => {
  if (!graph.isGraphEnabled()) {
    return res.json({
      success: true,
      data: { enabled: false, users: 0, connections: 0 },
    });
  }
  const stats = await graph.getGraphStats();
  res.json({ success: true, data: { enabled: true, ...stats } });
});

/**
 * GET /api/graph/mutual/:userId
 * The people you and this user both know.
 */
const getMutual = asyncHandler(async (req, res) => {
  assertGraph();
  const me = requesterId(req);
  const { userId } = req.params;

  if (userId === me) {
    throw new AppError('Cannot compute mutual connections with yourself', 400, 'VALIDATION_ERROR');
  }

  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const mutuals = await graph.getMutualConnections(me, userId, limit);

  // A mutual connection is normally someone the viewer already knows, and so
  // visible to them; this drops the rest, which the graph can still return
  // when the mirror is ahead of a privacy change.
  const hidden = await getHiddenUserIds(me, requesterRole(req));
  const visible = mutuals.filter((u) => !hidden.has(u.id));

  res.json({
    success: true,
    data: { count: visible.length, mutuals: visible },
  });
});

/**
 * GET /api/graph/path/:userId
 * Shortest connection path, e.g. Bala → Arun → Priya (2 degrees).
 */
const getPath = asyncHandler(async (req, res) => {
  assertGraph();
  const me = requesterId(req);
  const { userId } = req.params;
  const maxHops = Math.min(10, Math.max(1, parseInt(req.query.maxHops, 10) || 6));

  const hidden = await getHiddenUserIds(me, requesterRole(req));
  if (hidden.has(userId)) {
    throw new AppError('This profile is only visible to connections', 404, 'PROFILE_NOT_FOUND');
  }

  const result = await graph.getShortestPath(me, userId, maxHops);
  result.path = redactPath(result.path, hidden);
  res.json({ success: true, data: result });
});

/**
 * GET /api/graph/suggestions
 * People within two hops, ranked by shared connections.
 */
const getSuggestions = asyncHandler(async (req, res) => {
  assertGraph();
  const me = requesterId(req);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const role = ['STUDENT', 'ALUMNI'].includes(String(req.query.role).toUpperCase())
    ? String(req.query.role).toUpperCase()
    : null;

  const suggestions = await graph.getSuggestions(me, { limit, role });

  // Suggesting someone who restricted their profile would expose both their
  // existence and the names they are reachable through.
  const hidden = await getHiddenUserIds(me, requesterRole(req));
  const visible = suggestions.filter((s) => !hidden.has(s.user?.id));

  res.json({ success: true, data: { suggestions: visible } });
});

/**
 * GET /api/graph/company/:company
 * Alumni at a company reachable through your network, nearest first.
 */
const getReachableAtCompany = asyncHandler(async (req, res) => {
  assertGraph();
  const me = requesterId(req);
  const { company } = req.params;

  if (!company || !company.trim()) {
    throw new AppError('A company name is required', 400, 'VALIDATION_ERROR');
  }

  const maxHops = Math.min(6, Math.max(1, parseInt(req.query.maxHops, 10) || 4));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 25));

  const people = await graph.getReachableAtCompany(me, company.trim(), { maxHops, limit });

  const hidden = await getHiddenUserIds(me, requesterRole(req));
  const visible = people.filter((p) => !hidden.has(p.user?.id));

  res.json({
    success: true,
    data: { company: company.trim(), count: visible.length, people: visible },
  });
});

/**
 * GET /api/graph/network
 * Nodes and edges around the requester, for the visual graph page.
 */
const getNetwork = asyncHandler(async (req, res) => {
  assertGraph();
  const me = requesterId(req);
  const depth = Math.min(3, Math.max(1, parseInt(req.query.depth, 10) || 2));
  const limit = Math.min(300, Math.max(10, parseInt(req.query.limit, 10) || 120));

  const { nodes, edges } = await graph.getNetworkGraph(me, { depth, limit });

  // Remove hidden people and any edge that touched them, so the drawing
  // cannot imply a node that is not in the list.
  const hidden = await getHiddenUserIds(me, requesterRole(req));
  const visibleNodes = nodes.filter((nd) => !hidden.has(nd.id));
  const visibleEdges = edges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target));

  res.json({
    success: true,
    data: {
      rootId: me,
      depth,
      nodes: visibleNodes,
      edges: visibleEdges,
      counts: { nodes: visibleNodes.length, edges: visibleEdges.length },
    },
  });
});

/**
 * POST /api/graph/mutual-counts
 * Body: { userIds: [...] }
 * Mutual counts for a list of people, so cards can show "4 mutual
 * connections" without one request per card.
 */
const getMutualCounts = asyncHandler(async (req, res) => {
  const me = requesterId(req);
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError('userIds must be a non-empty array', 400, 'VALIDATION_ERROR');
  }
  if (userIds.length > 100) {
    throw new AppError('At most 100 userIds per request', 400, 'VALIDATION_ERROR');
  }

  // Cards should still render when the graph is down; zero counts are an
  // acceptable degradation, an error page is not.
  if (!graph.isGraphEnabled()) {
    return res.json({ success: true, data: { counts: {}, graphEnabled: false } });
  }

  // Drop hidden people before querying: a count keyed by their id would
  // confirm they exist, which is what CONNECTIONS_ONLY is meant to prevent.
  const hidden = await getHiddenUserIds(me, requesterRole(req));
  const allowedIds = userIds.filter((id) => !hidden.has(id));

  if (!allowedIds.length) {
    return res.json({ success: true, data: { counts: {}, graphEnabled: true } });
  }

  const counts = await graph.getMutualCounts(me, allowedIds);
  res.json({ success: true, data: { counts, graphEnabled: true } });
});

/**
 * POST /api/graph/resync
 * Admin-only: rebuild the graph from PostgreSQL without shell access.
 */
const resync = asyncHandler(async (req, res) => {
  assertGraph();

  await graph.ensureSchema();

  const users = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'ALUMNI'] } },
    include: {
      academicProfile: { include: { department: true } },
      alumniProfile: { include: { company: true } },
    },
  });

  await graph.upsertUsers(users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    department: u.academicProfile?.department?.code ?? null,
    graduationYear: u.academicProfile?.graduationYear ?? null,
    company: u.alumniProfile?.company?.name ?? null,
    designation: u.alumniProfile?.designation ?? null,
  })));

  const connections = await prisma.connection.findMany();
  await graph.addConnections(connections.map((c) => ({
    userA: c.userA,
    userB: c.userB,
    since: c.connectedAt?.toISOString() ?? null,
  })));

  await prisma.connection.updateMany({ data: { graphSyncedAt: new Date() } });

  const stats = await graph.getGraphStats();
  res.json({
    success: true,
    data: { ...stats, message: `Graph rebuilt: ${stats.users} users, ${stats.connections} connections` },
  });
});

/**
 * GET /api/graph/campus
 * Administrators only: the whole campus network, independent of any viewer.
 * The personal /network view is empty for an admin, who has no connections.
 */
const getCampus = asyncHandler(async (req, res) => {
  assertGraph();

  const limit = Math.min(400, Math.max(10, parseInt(req.query.limit, 10) || 150));
  const role = ['STUDENT', 'ALUMNI'].includes(String(req.query.role).toUpperCase())
    ? String(req.query.role).toUpperCase()
    : null;
  const department = req.query.department?.trim() || null;
  const company = req.query.company?.trim() || null;

  const { nodes, edges, degrees } = await graph.getCampusGraph({
    limit, role, department, company,
  });

  res.json({
    success: true,
    data: { nodes, edges, degrees, counts: { nodes: nodes.length, edges: edges.length } },
  });
});

/**
 * GET /api/graph/campus/path?from=&to=
 * Administrators only: the route between any two people.
 */
const getCampusPath = asyncHandler(async (req, res) => {
  assertGraph();

  const { from, to } = req.query;
  if (!from || !to) {
    throw new AppError('Both from and to user ids are required', 400, 'VALIDATION_ERROR');
  }

  const maxHops = Math.min(10, Math.max(1, parseInt(req.query.maxHops, 10) || 6));
  res.json({ success: true, data: await graph.getPathBetween(from, to, maxHops) });
});

/**
 * GET /api/graph/campus/search?q=
 * Administrators only: find a person to centre the graph on.
 */
const searchGraphUsers = asyncHandler(async (req, res) => {
  assertGraph();

  const q = req.query.q?.trim();
  if (!q || q.length < 2) {
    return res.json({ success: true, data: { users: [] } });
  }

  const limit = Math.min(25, Math.max(1, parseInt(req.query.limit, 10) || 10));
  res.json({ success: true, data: { users: await graph.searchUsers(q, limit) } });
});

/**
 * GET /api/graph/campus/top
 * Administrators only: the best-connected people on campus.
 */
const getTopConnectors = asyncHandler(async (req, res) => {
  assertGraph();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  res.json({ success: true, data: { connectors: await graph.getTopConnectors(limit) } });
});

module.exports = {
  getStatus,
  getCampus,
  getCampusPath,
  searchGraphUsers,
  getTopConnectors,
  getMutual,
  getPath,
  getSuggestions,
  getReachableAtCompany,
  getNetwork,
  getMutualCounts,
  resync,
};
