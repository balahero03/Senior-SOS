// backend/src/services/presenceService.js
// Who is online, and when they were last seen.
//
// Each open socket is a member of the user's sorted set in Redis, scored by the
// time it expires. Every backend refreshes the scores of its own sockets, so if
// an instance dies its sockets age out within SOCKET_TTL_MS instead of leaving
// the user "online" forever. Without Redis the same logic runs against an
// in-process map, which is correct for a single instance.
//
// Presence is private information. getPresenceFor() only reports users the
// viewer is connected to, the same rule that limits who can message whom.

'use strict';

const { prisma } = require('../database/postgres');
const { getRedisClient } = require('../database/redis');

const SOCKET_TTL_MS = 60_000;       // a socket not refreshed for this long is gone
const HEARTBEAT_MS = 20_000;        // how often a live socket refreshes itself
const LAST_SEEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_IDS = 100;

const setKey = (userId) => `presence:user:${userId}`;
const seenKey = (userId) => `presence:seen:${userId}`;

// ─── In-process fallback ─────────────────────────────────────────────────────
const memorySockets = new Map(); // userId -> Map(socketId -> expiresAt)
const memorySeen = new Map();    // userId -> timestamp

function memoryLive(userId, now) {
  const sockets = memorySockets.get(userId);
  if (!sockets) return 0;
  for (const [id, expiresAt] of sockets) if (expiresAt <= now) sockets.delete(id);
  if (sockets.size === 0) memorySockets.delete(userId);
  return sockets.size;
}

// ─── Socket lifecycle ────────────────────────────────────────────────────────

/**
 * Registers a socket. Returns true when this made the user newly online.
 */
async function connect(userId, socketId) {
  const now = Date.now();
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.zremrangebyscore(setKey(userId), '-inf', now);
      const before = await redis.zcard(setKey(userId));
      await redis.zadd(setKey(userId), now + SOCKET_TTL_MS, socketId);
      await redis.pexpire(setKey(userId), SOCKET_TTL_MS * 2);
      return before === 0;
    } catch {
      // fall through to memory
    }
  }
  const wasOnline = memoryLive(userId, now) > 0;
  if (!memorySockets.has(userId)) memorySockets.set(userId, new Map());
  memorySockets.get(userId).set(socketId, now + SOCKET_TTL_MS);
  return !wasOnline;
}

/** Keeps a live socket alive. Call every HEARTBEAT_MS. */
async function heartbeat(userId, socketId) {
  const now = Date.now();
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.zadd(setKey(userId), 'XX', now + SOCKET_TTL_MS, socketId);
      await redis.pexpire(setKey(userId), SOCKET_TTL_MS * 2);
      return;
    } catch {
      // fall through
    }
  }
  const sockets = memorySockets.get(userId);
  if (sockets && sockets.has(socketId)) sockets.set(socketId, now + SOCKET_TTL_MS);
}

/**
 * Unregisters a socket. Returns true when this made the user offline (their
 * last socket closed); the last-seen time is recorded in that case.
 */
async function disconnect(userId, socketId) {
  const now = Date.now();
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.zrem(setKey(userId), socketId);
      await redis.zremrangebyscore(setKey(userId), '-inf', now);
      const remaining = await redis.zcard(setKey(userId));
      if (remaining === 0) {
        await redis.set(seenKey(userId), String(now), 'EX', LAST_SEEN_TTL_SECONDS);
        return true;
      }
      return false;
    } catch {
      // fall through
    }
  }
  memorySockets.get(userId)?.delete(socketId);
  if (memoryLive(userId, now) === 0) {
    memorySeen.set(userId, now);
    return true;
  }
  return false;
}

// ─── Reading presence ────────────────────────────────────────────────────────

/** { online, lastSeen } for each id, with no privacy filtering. */
async function readPresence(userIds) {
  const now = Date.now();
  const result = {};
  const redis = getRedisClient();
  if (redis) {
    try {
      const pipe = redis.pipeline();
      for (const id of userIds) {
        pipe.zcount(setKey(id), now, '+inf');
        pipe.get(seenKey(id));
      }
      const rows = await pipe.exec();
      userIds.forEach((id, i) => {
        const online = Number(rows[i * 2][1]) > 0;
        const seen = rows[i * 2 + 1][1];
        result[id] = { online, lastSeen: online ? null : (seen ? Number(seen) : null) };
      });
      return result;
    } catch {
      // fall through
    }
  }
  for (const id of userIds) {
    const online = memoryLive(id, now) > 0;
    result[id] = { online, lastSeen: online ? null : (memorySeen.get(id) || null) };
  }
  return result;
}

/** Ids of everyone this user is connected to. */
async function getConnectionIds(userId) {
  const rows = await prisma.connection.findMany({
    where: { OR: [{ userA: userId }, { userB: userId }] },
    select: { userA: true, userB: true },
  });
  return rows.map((c) => (c.userA === userId ? c.userB : c.userA));
}

/**
 * Presence for the requested users, limited to people the viewer is connected
 * to. Anyone else is simply absent from the result.
 */
async function getPresenceFor(viewerId, requestedIds) {
  const ids = [...new Set(requestedIds)].slice(0, MAX_IDS);
  if (ids.length === 0) return {};
  const connected = new Set(await getConnectionIds(viewerId));
  const allowed = ids.filter((id) => connected.has(id));
  return readPresence(allowed);
}

module.exports = {
  connect,
  heartbeat,
  disconnect,
  getPresenceFor,
  getConnectionIds,
  HEARTBEAT_MS,
  SOCKET_TTL_MS,
  MAX_IDS,
};
