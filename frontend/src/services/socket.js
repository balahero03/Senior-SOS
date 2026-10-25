// frontend/src/services/socket.js
// Socket.IO client singleton for realtime messaging.
// Per FOLDER_STRUCTURE.md §frontend/src/services/:
//   "Shared communication setup."

import { io } from 'socket.io-client';

// In development, Vite proxies /socket.io to http://localhost:5000
// so we connect to the same origin the frontend runs on.
const BACKEND_URL = import.meta.env.VITE_API_URL || window.location.origin;

let socket = null;

/**
 * Connect to the Socket.IO server.
 * If already connected, returns the existing connection.
 */
export function connectSocket() {
  // One socket per tab, even while it is still connecting.
  if (socket) return socket;

  socket = io(BACKEND_URL, {
    withCredentials: true,     // send httpOnly cookies
    // WebSocket only. Socket.IO's long-polling fallback sends several HTTP
    // requests that must all reach the SAME backend copy, which cannot be
    // guaranteed once more than one backend replica runs behind a load balancer
    // (Kubernetes). A WebSocket is one connection, so it works with any number
    // of replicas, and every current browser supports it.
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[socket] Connected to realtime server:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[socket] Connection error:', err.message);
  });

  return socket;
}

/**
 * Disconnect from the Socket.IO server.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the active socket instance (may be null if not connected).
 */
export function getSocket() {
  return socket;
}
