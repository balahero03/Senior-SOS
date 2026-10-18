// backend/prisma/seed-connections.js
// Builds the connection network in PostgreSQL, which is the system of record
// for the graph. Run this before syncing to Neo4j.
//
// Produces a believable network rather than random noise: people are more
// likely to be connected to their own department and their own era, and the
// demo accounts are deliberately well connected so mutual counts, paths and
// the graph page have something to show.
//
// Idempotent: generated connections and requests are cleared and rebuilt.
// Accounts are never touched.
//
// Usage: npm run db:seed:connections

'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Users who should have large, visible networks.
const HUB_MATCHERS = ['aravind', 'balamuthukrishnan', 'oviya', 'pooja'];
const HUB_CONNECTIONS = [45, 60];
const NORMAL_CONNECTIONS = [6, 20];

// Deterministic RNG so the same network is reproducible.
let rngState = 20261018;
function rand() {
  rngState |= 0;
  rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p) => rand() < p;
function pickMany(arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}
function dateWithin(days) {
  return new Date(Date.now() - Math.floor(rand() * days * 24 * 3600 * 1000));
}
const canonical = (a, b) => (a < b ? { userA: a, userB: b } : { userA: b, userB: a });

async function main() {
  console.log('\n🕸️  [connections] Building the campus network\n');
  const started = Date.now();

  const users = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'ALUMNI'] }, status: 'ACTIVE' },
    include: { academicProfile: { include: { department: true } } },
  });
  console.log(`  · ${users.length} eligible users`);

  const isHub = (u) => HUB_MATCHERS.some(
    (m) => u.name.toLowerCase().includes(m) || u.email.toLowerCase().includes(m),
  );
  const hubs = users.filter(isHub);
  console.log(`  · hubs: ${hubs.map((h) => h.name).join(', ') || 'none found'}`);

  // Rebuild from scratch so re-runs stay predictable.
  await prisma.connection.deleteMany({});
  await prisma.connectionRequest.deleteMany({});
  console.log('  · cleared existing connections and requests');

  const pairs = new Map();
  function connect(a, b) {
    if (a === b) return;
    const { userA, userB } = canonical(a, b);
    const key = `${userA}|${userB}`;
    if (!pairs.has(key)) {
      pairs.set(key, { userA, userB, connectedAt: dateWithin(400), graphSyncedAt: null });
    }
  }

  // Hubs: large mixed networks, and connected to each other so there are
  // short paths between the demo accounts.
  const alumni = users.filter((u) => u.role === 'ALUMNI');
  const students = users.filter((u) => u.role === 'STUDENT');

  for (const hub of hubs) {
    const target = randInt(...HUB_CONNECTIONS);
    const half = Math.ceil(target / 2);
    for (const other of pickMany(alumni.filter((u) => u.id !== hub.id), half)) connect(hub.id, other.id);
    for (const other of pickMany(students.filter((u) => u.id !== hub.id), target - half)) connect(hub.id, other.id);
  }
  for (let i = 0; i < hubs.length; i += 1) {
    for (let j = i + 1; j < hubs.length; j += 1) connect(hubs[i].id, hubs[j].id);
  }

  // Everyone else: weighted toward same department and nearby graduation year,
  // which is what makes mutual connections cluster the way a real network does.
  for (const person of users) {
    if (isHub(person)) continue;

    const dept = person.academicProfile?.department?.code;
    const year = person.academicProfile?.graduationYear || 0;
    const others = users.filter((u) => u.id !== person.id);
    const sameDept = others.filter((u) => u.academicProfile?.department?.code === dept);
    const nearYear = others.filter(
      (u) => Math.abs((u.academicProfile?.graduationYear || 0) - year) <= 2,
    );

    const target = randInt(...NORMAL_CONNECTIONS);
    for (const o of pickMany(sameDept, Math.ceil(target * 0.45))) connect(person.id, o.id);
    for (const o of pickMany(nearYear, Math.ceil(target * 0.3))) connect(person.id, o.id);
    for (const o of pickMany(others, Math.ceil(target * 0.3))) connect(person.id, o.id);
  }

  const rows = [...pairs.values()];
  await prisma.connection.createMany({ data: rows, skipDuplicates: true });
  console.log(`  ✓ ${rows.length} connections created`);

  // Pending requests, so the Network page has something to act on.
  const requests = [];
  const requested = new Set();
  function request(senderId, receiverId, status) {
    if (senderId === receiverId) return;
    const { userA, userB } = canonical(senderId, receiverId);
    if (pairs.has(`${userA}|${userB}`)) return;      // already connected
    const key = `${senderId}|${receiverId}`;
    if (requested.has(key) || requested.has(`${receiverId}|${senderId}`)) return;
    requested.add(key);
    requests.push({ senderId, receiverId, status, createdAt: dateWithin(21) });
  }

  for (const hub of hubs) {
    const others = users.filter((u) => u.id !== hub.id);
    for (const s of pickMany(others, randInt(6, 10))) request(s.id, hub.id, 'PENDING');
    for (const r of pickMany(others, randInt(3, 6))) request(hub.id, r.id, 'PENDING');
  }
  for (const person of pickMany(users, Math.floor(users.length * 0.5))) {
    const others = users.filter((u) => u.id !== person.id);
    for (const r of pickMany(others, randInt(1, 3))) {
      request(person.id, r.id, chance(0.75) ? 'PENDING' : 'REJECTED');
    }
  }
  await prisma.connectionRequest.createMany({ data: requests, skipDuplicates: true });
  console.log(`  ✓ ${requests.length} connection requests created`);

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('\n🔗 Hub networks');
  for (const hub of hubs) {
    const [degree, pending] = await Promise.all([
      prisma.connection.count({ where: { OR: [{ userA: hub.id }, { userB: hub.id }] } }),
      prisma.connectionRequest.count({ where: { receiverId: hub.id, status: 'PENDING' } }),
    ]);
    console.log(`   ${hub.name.padEnd(24)} ${String(degree).padStart(3)} connections, ${pending} pending`);
  }

  const total = await prisma.connection.count();
  console.log(`\n   Total connections: ${total} across ${users.length} users`);
  console.log(`   Average degree   : ${((total * 2) / users.length).toFixed(1)}`);
  console.log(`\n✅ [connections] Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log('   Next: npm run graph:sync to mirror this into Neo4j\n');
}

main()
  .catch((err) => {
    console.error('\n❌ [connections] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
