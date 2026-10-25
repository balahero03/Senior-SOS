// backend/src/server.js
// Entry point: connects to PostgreSQL + MongoDB, then starts the HTTP server.
// Handles graceful shutdown on SIGINT / SIGTERM.

'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

require('dotenv').config();


const config = require('./config');
const app = require('./app');
const { connectPostgres, disconnectPostgres } = require('./database/postgres');
const { connectMongoDB, disconnectMongoDB } = require('./database/mongodb');
const { connectNeo4j, disconnectNeo4j } = require('./database/neo4j');
const { connectRedis, disconnectRedis } = require('./database/redis');
const { initSocket } = require('./realtime/socket');

async function startServer() {
  // Connect both databases before accepting requests
  await connectPostgres();
  await connectMongoDB();
  // Graph is a derived view; a failure here logs and disables graph
  // features rather than preventing startup.
  await connectNeo4j();
  // Redis is an accelerator only: unreachable or unset just means no caching.
  await connectRedis();

  const server = app.listen(config.port, () => {
    console.log(`[server] SeniorSOS backend running on port ${config.port} (${config.env})`);
    console.log(`[server] Health: http://localhost:${config.port}/health`);
  });

  // Initialize WebSockets gateway
  initSocket(server);

  // ─── Graceful shutdown ───────────────────────────────────────────────────

  async function shutdown(signal) {
    console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      await disconnectPostgres();
      await disconnectMongoDB();
      await disconnectNeo4j();
      await disconnectRedis();
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


