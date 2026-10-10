// backend/src/server.js
// Entry point: connects to PostgreSQL, then starts the HTTP server.
// Handles graceful shutdown on SIGINT / SIGTERM.

'use strict';

require('dotenv').config();

const config = require('./config');
const app = require('./app');
const { connectPostgres, disconnectPostgres } = require('./database/postgres');

async function startServer() {
  // Connect database before accepting requests
  await connectPostgres();

  const server = app.listen(config.port, () => {
    console.log(`[server] SeniorSOS backend running on port ${config.port} (${config.env})`);
    console.log(`[server] Health: http://localhost:${config.port}/health`);
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────

  async function shutdown(signal) {
    console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      await disconnectPostgres();
      console.log('[server] HTTP server closed. Exiting.');
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error('[server] Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Unhandled rejection guard
  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled rejection:', reason);
  });
}

startServer().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
