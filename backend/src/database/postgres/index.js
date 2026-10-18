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
async function connectPostgres({ retries = 5, delayMs = 2000 } = {}) {
  // Serverless Postgres (Neon) suspends an idle compute endpoint to zero, so the
  // first connection after a quiet period can time out with P1001 while it cold
  // starts. Retry with backoff instead of letting one timeout kill the process.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await prisma.$connect();
      console.log('[postgres] Connected to PostgreSQL via Prisma');
      return;
    } catch (err) {
      const isUnreachable = err.errorCode === 'P1001' || err.errorCode === 'P1017';

      if (!isUnreachable || attempt > retries) {
        throw err;
      }

      const waitMs = delayMs * attempt;
      console.warn(
        `[postgres] Database unreachable (${err.errorCode}), attempt ${attempt}/${retries}. ` +
          `Retrying in ${waitMs}ms. If this is a serverless endpoint it may be cold starting.`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
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
