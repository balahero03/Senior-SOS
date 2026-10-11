// backend/src/realtime/socket.js
// Realtime WebSockets gateway using Socket.IO.
// Per FOLDER_STRUCTURE.md §backend/src/realtime/:
//   "Socket.IO connection handling, room management, event emitters."

'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

let io = null;

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

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: User ${userId}`);
    });
  });

  return io;
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
  getIO,
  emitToUser,
};
