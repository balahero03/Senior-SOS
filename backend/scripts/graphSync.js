// backend/scripts/graphSync.js
// Mirrors users and connections from PostgreSQL into Neo4j.
//
// PostgreSQL stays the system of record; the graph is a derived view rebuilt
// from it. connections.graph_synced_at marks what has been mirrored, so an
// incremental run only sends what changed.
//
//   npm run graph:sync            incremental — unsynced connections only
//   npm run graph:sync -- --full  wipe the graph and rebuild from scratch
//   npm run graph:sync -- --stats counts only, no writes
//
// Safe to re-run: every write is a MERGE.

'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const config = require('../src/config');
const { connectNeo4j, disconnectNeo4j, runQuery, isGraphEnabled } = require('../src/database/neo4j');
const graph = require('../src/services/graphService');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const FULL = args.includes('--full');
const STATS_ONLY = args.includes('--stats');
const BATCH = 500;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log('\n🕸️  [graph:sync] Mirroring PostgreSQL → Neo4j\n');
  const started = Date.now();

  if (!config.neo4j.enabled) {
    console.error('❌ Neo4j is not configured.');
    console.error('   Set NEO4J_URI and NEO4J_PASSWORD in backend/.env, then re-run.');
    console.error('   Create a free instance at https://console.neo4j.io\n');
    process.exitCode = 1;
    return;
  }

  await connectNeo4j();
  if (!isGraphEnabled()) {
    console.error('❌ Could not connect to Neo4j. Check NEO4J_URI and NEO4J_PASSWORD.\n');
    process.exitCode = 1;
    return;
  }

  if (STATS_ONLY) {
    const stats = await graph.getGraphStats();
    const [pgUsers, pgConns, unsynced] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['STUDENT', 'ALUMNI'] } } }),
      prisma.connection.count(),
      prisma.connection.count({ where: { graphSyncedAt: null } }),
    ]);
    console.log('  PostgreSQL');
    console.log(`    users       ${pgUsers}`);
    console.log(`    connections ${pgConns}  (${unsynced} not yet mirrored)`);
    console.log('  Neo4j');
    console.log(`    users       ${stats.users}`);
    console.log(`    connections ${stats.connections}\n`);
    return;
  }

  // ─── Schema ───────────────────────────────────────────────────────────────

  console.log('  · ensuring constraints and indexes');
  await graph.ensureSchema();

  if (FULL) {
    console.log('  · --full: clearing the existing graph');
    await runQuery('MATCH (n:User) DETACH DELETE n', {}, { write: true });
    // Everything must be mirrored again.
    await prisma.connection.updateMany({ data: { graphSyncedAt: null } });
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  const users = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'ALUMNI'] } },
    include: {
      academicProfile: { include: { department: true } },
      alumniProfile: { include: { company: true } },
    },
  });

  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    department: u.academicProfile?.department?.code ?? null,
    graduationYear: u.academicProfile?.graduationYear ?? null,
    company: u.alumniProfile?.company?.name ?? null,
    designation: u.alumniProfile?.designation ?? null,
  }));

  for (const batch of chunk(userRows, BATCH)) {
    await graph.upsertUsers(batch);
  }
  console.log(`  ✓ ${userRows.length} user nodes upserted`);

  // ─── Connections ──────────────────────────────────────────────────────────

  const where = FULL ? {} : { graphSyncedAt: null };
  const connections = await prisma.connection.findMany({ where });

  if (!connections.length) {
    console.log('  · no connections to mirror (already up to date)');
  } else {
    const pairs = connections.map((c) => ({
      userA: c.userA,
      userB: c.userB,
      since: c.connectedAt?.toISOString() ?? null,
    }));

    let done = 0;
    for (const batch of chunk(pairs, BATCH)) {
      await graph.addConnections(batch);
      done += batch.length;
      process.stdout.write(`\r  · mirrored ${done}/${pairs.length} connections`);
    }
    process.stdout.write('\n');

    // Mark them synced only after the writes succeeded, so a failure part way
    // through is retried rather than silently skipped.
    const now = new Date();
    for (const batch of chunk(connections, BATCH)) {
      await prisma.$transaction(
        batch.map((c) => prisma.connection.update({
          where: { userA_userB: { userA: c.userA, userB: c.userB } },
          data: { graphSyncedAt: now },
        })),
      );
    }
    console.log(`  ✓ ${connections.length} connections mirrored and marked synced`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  const stats = await graph.getGraphStats();
  console.log('\n📊 Graph now holds');
  console.log(`   users       ${stats.users}`);
  console.log(`   connections ${stats.connections}`);

  // A quick sanity query, so the script proves the graph is usable.
  const hub = users.find((u) => /aravind|balamuthukrishnan|oviya|pooja/i.test(u.name));
  if (hub) {
    const degree = await graph.getDegree(hub.id);
    console.log(`\n   ${hub.name}: ${degree} connections in the graph`);
    const suggestions = await graph.getSuggestions(hub.id, { limit: 3 });
    for (const s of suggestions) {
      console.log(`     suggest ${s.user.name} — ${s.mutualCount} mutual (via ${s.viaNames.join(', ')})`);
    }
  }

  console.log(`\n✅ [graph:sync] Done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}

main()
  .catch((err) => {
    console.error('\n❌ [graph:sync] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await disconnectNeo4j();
  });
