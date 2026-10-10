// backend/src/database/postgres/index.js
// Prisma client singleton. Exports one shared instance for the entire process.
//
// Rules (from FOLDER_STRUCTURE.md):
//   - Database connection setup is centralised here; controllers never import Prisma directly.
//   - One connection pool per process — do not create a new client per request.
//   - Shutdown is handled gracefully on SIGINT / SIGTERM (called from server.js).

'use strict';

const { PrismaClient } = require('@prisma/client');
const config = require('../../config');

const prisma = new PrismaClient({
  log: config.isDevelopment
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
  errorFormat: 'minimal',
});

/**
 * Opens the Prisma connection pool and verifies connectivity.
 * Call once at application startup (server.js).
 */
async function connectPostgres() {
  await prisma.$connect();
  console.log('[postgres] Connected to PostgreSQL via Prisma');
}

/**
 * Gracefully closes the connection pool.
 * Call on SIGINT / SIGTERM in server.js.
 */
async function disconnectPostgres() {
  await prisma.$disconnect();
  console.log('[postgres] Disconnected from PostgreSQL');
}

module.exports = {
  prisma,
  connectPostgres,
  disconnectPostgres,
};
