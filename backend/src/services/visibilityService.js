// backend/src/services/visibilityService.js
// Shared profile-visibility rules.
//
// A user may set profile_visibility to 'CONNECTIONS_ONLY', which hides them
// from everyone they are not connected to. That rule is an authorization
// boundary, not a search preference, so every feature that surfaces people
// has to apply it — the directory, the recommendations, and the graph alike.
//
// This lives in one place because the rule was previously re-implemented per
// endpoint, and features added later (best fit, the network graph) did not
// carry it over.

'use strict';

const { prisma } = require('../database/postgres');

/**
 * The set of user ids the viewer is connected to.
 *
 * @param {string} viewerId
 * @returns {Promise<Set<string>>}
 */
async function getConnectedUserIds(viewerId) {
  const rows = await prisma.connection.findMany({
    where: { OR: [{ userA: viewerId }, { userB: viewerId }] },
    select: { userA: true, userB: true },
  });
  return new Set(rows.map((c) => (c.userA === viewerId ? c.userB : c.userA)));
}

/**
 * The ids the viewer is not allowed to see: everyone set to
 * CONNECTIONS_ONLY who is neither the viewer nor one of their connections.
 *
 * Administrators moderate the platform and already have a user-management
 * view, so they are exempt and always get an empty set.
 *
 * @param {string} viewerId
 * @param {string} [viewerRole]  'ADMIN' bypasses the restriction
 * @returns {Promise<Set<string>>}
 */
async function getHiddenUserIds(viewerId, viewerRole) {
  if (viewerRole === 'ADMIN') return new Set();

  const connected = await getConnectedUserIds(viewerId);
  const visibleToViewer = [viewerId, ...connected];

  const rows = await prisma.userSettings.findMany({
    where: {
      profileVisibility: 'CONNECTIONS_ONLY',
      userId: { notIn: visibleToViewer },
    },
    select: { userId: true },
  });

  return new Set(rows.map((r) => r.userId));
}

/**
 * Drops hidden people from a list of records.
 *
 * @param {object[]} items
 * @param {Set<string>} hiddenIds
 * @param {(item: object) => string} getId  Reads the user id off one item
 */
function filterHidden(items, hiddenIds, getId = (x) => x.id) {
  if (!hiddenIds.size) return items;
  return items.filter((item) => !hiddenIds.has(getId(item)));
}

module.exports = { getConnectedUserIds, getHiddenUserIds, filterHidden };
