// frontend/src/features/networking/graphApi.js
// Graph endpoints: mutual connections, shortest paths, suggestions and the
// network view. All are backed by Neo4j and degrade when it is unavailable.

import api from '../../services/api';

/** Whether graph features are usable, and what the graph holds. */
export const getGraphStatus = () =>
  api.get('/graph/status').then((r) => r.data.data);

/** Nodes and edges around the current user, for the graph canvas. */
export const getNetworkGraph = (params = {}) =>
  api.get('/graph/network', { params }).then((r) => r.data.data);

/** People you and this user both know. */
export const getMutualConnections = (userId, limit) =>
  api.get(`/graph/mutual/${userId}`, { params: limit ? { limit } : {} })
    .then((r) => r.data.data);

/** Shortest connection path to this user. */
export const getConnectionPath = (userId, maxHops) =>
  api.get(`/graph/path/${userId}`, { params: maxHops ? { maxHops } : {} })
    .then((r) => r.data.data);

/** People within two hops, ranked by shared connections. */
export const getGraphSuggestions = (params = {}) =>
  api.get('/graph/suggestions', { params }).then((r) => r.data.data.suggestions);

/** Alumni at a company reachable through your network. */
export const getReachableAtCompany = (company, params = {}) =>
  api.get(`/graph/company/${encodeURIComponent(company)}`, { params })
    .then((r) => r.data.data);

/** Mutual counts for many users at once, for card lists. */
export const getMutualCounts = (userIds) =>
  api.post('/graph/mutual-counts', { userIds }).then((r) => r.data.data);

// ─── Administrator views ─────────────────────────────────────────────────────
// The personal /network view renders the viewer's own neighbourhood, which is
// empty for an admin account. These return the campus network instead.

/** The whole campus graph, optionally filtered. */
export const getCampusGraph = (params = {}) =>
  api.get('/graph/campus', { params }).then((r) => r.data.data);

/** Shortest path between any two people. */
export const getPathBetween = (from, to, maxHops) =>
  api.get('/graph/campus/path', { params: { from, to, ...(maxHops && { maxHops }) } })
    .then((r) => r.data.data);

/** Find a person to centre the graph on. */
export const searchGraphUsers = (q, limit) =>
  api.get('/graph/campus/search', { params: { q, ...(limit && { limit }) } })
    .then((r) => r.data.data.users);

/** The best-connected people on campus. */
export const getTopConnectors = (limit) =>
  api.get('/graph/campus/top', { params: limit ? { limit } : {} })
    .then((r) => r.data.data.connectors);
