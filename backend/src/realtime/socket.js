// backend/src/realtime/socket.js
// Realtime WebSockets gateway using Socket.IO.
// Per FOLDER_STRUCTURE.md §backend/src/realtime/:
//   "Socket.IO connection handling, room management, event emitters."

'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('../config');
const { createRedisConnection, isRedisEnabled } = require('../database/redis');
const presence = require('../services/presenceService');

let io = null;
let adapterClients = [];

/**
 * Initialize Socket.IO server bound to HTTP server instance.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.clientOrigin,
      credentials: true,
    },
  });

  // With several backend replicas, a user's socket may live on a different
  // replica than the one handling the request that emits to them. The Redis
  // adapter relays events between replicas so emitToUser still reaches them.
  // Without Redis this stays single-instance, as before.
  if (isRedisEnabled()) {
    const pub = createRedisConnection();
    const sub = pub && pub.duplicate();
    if (pub && sub) {
      sub.on('error', () => {});
      adapterClients = [pub, sub];
      io.adapter(createAdapter(pub, sub, { key: 'sos:socket.io' }));
      console.log('🔌 [socket] Redis adapter enabled (multi-instance realtime)');
    }
  } else {
    console.log('🔌 [socket] Single-instance realtime (no Redis adapter)');
  }

  // JWT authentication middleware for WebSocket connections
  io.use((socket, next) => {
    try {
      // Token can be sent in handshake auth object or query params or cookies
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const cookies = parseCookies(socket.handshake.headers.cookie);
        token = cookies.accessToken;
      }

      if (!token && socket.handshake.query?.token) {
        token = socket.handshake.query.token;
      }

      if (!token) {
        return next(new Error('Authentication required for WebSocket connection'));
      }

      const decoded = jwt.verify(token, config.jwt.accessSecret);
      // Access tokens identify their subject with `sub` (not `id`). Normalize
      // both shapes so room membership always uses the actual user UUID.
      socket.user = { ...decoded, id: decoded.sub || decoded.id };
      if (!socket.user.id) {
        return next(new Error('Invalid WebSocket authentication token'));
      }
      return next();
    } catch (err) {
      return next(new Error('Invalid or expired WebSocket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`🔌 Socket connected: User ${userId} (Socket ID: ${socket.id})`);

    // Join personal room for target user notifications/messages
    socket.join(`user:${userId}`);

    // Presence: track this socket, keep it alive, and tell the user's
    // connections when they first come online or fully go offline.
    presence.connect(userId, socket.id)
      .then((cameOnline) => { if (cameOnline) announcePresence(userId, true); })
      .catch((err) => console.error('[presence] connect failed:', err.message));

    const heartbeat = setInterval(() => {
      presence.heartbeat(userId, socket.id).catch(() => {});
    }, presence.HEARTBEAT_MS);

    socket.on('disconnect', () => {
      clearInterval(heartbeat);
      console.log(`🔌 Socket disconnected: User ${userId}`);
      presence.disconnect(userId, socket.id)
        .then((wentOffline) => { if (wentOffline) announcePresence(userId, false); })
        .catch((err) => console.error('[presence] disconnect failed:', err.message));
    });
  });

  return io;
}

/**
 * Pushes a presence change to the user's connections only. Delivered through
 * the same rooms (and Redis adapter) as messages, so it works across replicas.
 */
async function announcePresence(userId, online) {
  if (!io) return;
  try {
    const connectionIds = await presence.getConnectionIds(userId);
    if (connectionIds.length === 0) return;
    io.to(connectionIds.map((id) => `user:${id}`)).emit('presence:update', {
      userId,
      online,
      lastSeen: online ? null : Date.now(),
    });
  } catch (err) {
    console.error('[presence] announce failed:', err.message);
  }
}

/** Closes the adapter's Redis connections (graceful shutdown). */
async function closeSocket() {
  const clients = adapterClients;
  adapterClients = [];
  await Promise.all(clients.map((c) => c.quit().catch(() => c.disconnect())));
  if (io) {
    await new Promise((resolve) => io.close(resolve));
    io = null;
  }
}

/**
 * Helper to parse cookie string from headers
 */
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    const value = parts.join('=').trim();
    if (name) {
      list[name] = decodeURIComponent(value);
    }
  });

  return list;
}

/**
 * Get the initialized Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
}

/**
 * Emit an event to a specific user by userId
 * @param {string} userId
 * @param {string} event
 * @param {object} data
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

module.exports = {
  initSocket,
  closeSocket,
  getIO,
  emitToUser,
};
