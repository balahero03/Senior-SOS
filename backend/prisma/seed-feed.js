// backend/prisma/seed-feed.js
// Fills the community feed (posts, comments, reactions in MongoDB) with a small,
// realistic set of content written by real users, sized for a free-tier Atlas
// cluster (M0 allows 512 MB; this uses well under 1 MB).
//
// Unlike seed-content.js this script:
//   - never writes to PostgreSQL (it only reads users, profiles and skills);
//   - only uses authors whose profile is complete, so a post that mentions an
//     author's company or skills matches what their profile actually says;
//   - tags everything it inserts with seedBatch, and on a re-run removes ONLY
//     documents carrying that tag, so real user posts are never touched;
//   - does nothing unless --yes is passed (otherwise it is a dry run).
//
// Usage:
//   node prisma/seed-feed.js                dry run: shows the plan and sizes
//   node prisma/seed-feed.js --yes          write to the database in MONGODB_URI
//   node prisma/seed-feed.js --yes --posts=200

'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');

const {
  DEPT_SKILLS, DEPT_TRACK, DESIGNATIONS, TRACK_COMPANIES,
  COMPANY_CONTEXT, DEPT_FOCUS, UNIVERSAL_FOCUS,
} = require('./seed-data/reference');
const {
  ALUMNI_TEMPLATES, STUDENT_TEMPLATES, CAMPUS_TEMPLATES, COMMENT_TEMPLATES,
} = require('./seed-data/posts');

const prisma = new PrismaClient({ log: [] });

// ─── Options and size limits ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const WRITE = args.includes('--yes');
const postsArg = args.find((a) => a.startsWith('--posts='));
const TARGET_POSTS = Math.min(400, Math.max(20, parseInt(postsArg?.split('=')[1], 10) || 150));

const SEED_BATCH = 'seed-feed-v1';       // tag on every document this script inserts
const MAX_COMMENTS = 260;                // hard ceilings keep the data tiny
const MAX_REACTIONS = 900;
const POST_WINDOW_DAYS = 45;             // spread across the last ~6 weeks
const CURRENT_YEAR = new Date().getFullYear();
const ATLAS_M0_BYTES = 512 * 1024 * 1024;

// Named users who should look especially active.
const HUB_MATCHERS = ['aravind', 'balamuthukrishnan', 'oviya', 'pooja'];

// ─── Deterministic RNG (mulberry32): same feed on every run ──────────────────

let rngState = 20261025;
function rand() {
  rngState |= 0;
  rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
function pickMany(arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
const dateWithin = (days) => new Date(Date.now() - Math.floor(rand() * days * 24 * 3600 * 1000));

// ─── Template context ────────────────────────────────────────────────────────
// Built from the author's real profile only.

function buildContext(user, alumni) {
  const dept = user.academicProfile.department.code;
  const track = DEPT_TRACK[dept] || 'software';
  const ownSkills = user.userSkills.map((us) => us.skill.name);
  const [skill, skill2, skill3] = pickMany(ownSkills, 3);

  const company = user.alumniProfile?.company?.name || pick(TRACK_COMPANIES[track]);
  const info = COMPANY_CONTEXT[company] || { domain: 'large-scale engineering systems', scale: 'significant production load' };
  let otherCompany = pick(TRACK_COMPANIES[track]);
  if (otherCompany === company) otherCompany = pick(TRACK_COMPANIES[track].filter((c) => c !== company)) || otherCompany;

  return {
    name: user.name,
    firstName: user.name.split(' ')[0],
    role: user.role,
    dept,
    deptName: user.academicProfile.department.name,
    year: user.academicProfile.graduationYear || CURRENT_YEAR,
    company,
    otherCompany,
    designation: user.alumniProfile?.designation || pick(DESIGNATIONS[track]).title,
    domain: info.domain,
    scale: info.scale,
    skill,
    skill2: skill2 || skill,
    skill3: skill3 || skill,
    focus: pick([...(DEPT_FOCUS[dept] || DEPT_FOCUS.CSE), ...UNIVERSAL_FOCUS]),
    mentorName: pick(alumni)?.name?.split(' ')[0] || 'the seniors here',
    n: randInt(8, 45),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const redact = (uri) => String(uri).replace(/(:\/\/[^:/@]+:)[^@]+@/, '$1***@');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  console.log(`\n🌱 [feed] ${WRITE ? 'WRITE' : 'DRY RUN'} against ${redact(uri)}`);
  console.log(`   target ≈ ${TARGET_POSTS} posts (limits: ${MAX_COMMENTS} comments, ${MAX_REACTIONS} reactions)\n`);

  // ── Authors: complete profiles only (read-only on PostgreSQL) ──────────────
  const users = (await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'ALUMNI'] }, status: 'ACTIVE' },
    include: {
      academicProfile: { include: { department: true } },
      alumniProfile: { include: { company: true } },
      userSkills: { include: { skill: true } },
    },
  })).filter((u) => (
    u.academicProfile?.department
    && u.userSkills.length >= 3
    && (u.role === 'STUDENT'
      || (u.alumniProfile?.verificationStatus === 'APPROVED'
        && u.alumniProfile.company && u.alumniProfile.designation))
  ));

  const alumni = users.filter((u) => u.role === 'ALUMNI');
  const isHub = (u) => HUB_MATCHERS.some(
    (m) => u.name.toLowerCase().includes(m) || u.email.toLowerCase().includes(m),
  );
  const hubs = users.filter(isHub);
  console.log(`   eligible authors: ${users.length} (${alumni.length} alumni, ${users.length - alumni.length} students)`);
  console.log(`   active hubs: ${hubs.map((h) => h.name).join(', ') || 'none'}`);
  if (users.length < 10) throw new Error('Too few eligible users to build a feed.');

  // ── Who posts how much: hubs a lot, others once or twice, until the target ─
  const counts = new Map();
  let total = 0;
  for (const h of hubs) { const c = randInt(3, 5); counts.set(h.id, c); total += c; }
  for (const u of pickMany(users.filter((x) => !counts.has(x.id)), users.length)) {
    if (total >= TARGET_POSTS) break;
    const c = Math.min(randInt(1, 2), TARGET_POSTS - total);
    counts.set(u.id, c);
    total += c;
  }

  const byId = new Map(users.map((u) => [u.id, u]));
  const postDocs = [];
  for (const [userId, count] of counts) {
    const user = byId.get(userId);
    const family = user.role === 'ALUMNI' ? ALUMNI_TEMPLATES : STUDENT_TEMPLATES;
    const used = new Set();
    for (let i = 0; i < count; i += 1) {
      const useCampus = chance(0.15);
      const list = useCampus ? CAMPUS_TEMPLATES : family;
      let idx = Math.floor(rand() * list.length);
      for (let t = 0; t < list.length; t += 1) {
        const key = `${useCampus ? 'c' : 'f'}${idx}`;
        if (!used.has(key)) { used.add(key); break; }
        idx = (idx + 1) % list.length;
      }
      const { content, tags } = list[idx](buildContext(user, alumni));
      const createdAt = dateWithin(POST_WINDOW_DAYS);
      postDocs.push({
        _id: new mongoose.Types.ObjectId(),
        authorId: user.id,
        content,
        media: [],
        tags: [...new Set(tags.filter(Boolean).map((t) => String(t).toLowerCase()))].slice(0, 10),
        visibility: chance(0.86) ? 'COLLEGE' : 'CONNECTIONS',
        seedBatch: SEED_BATCH,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  // ── Comments (capped) ──────────────────────────────────────────────────────
  const now = Date.now();
  const render = (tpl, commenter) => {
    const ctx = buildContext(commenter, alumni);
    return tpl.replace(/\{skill\}/g, ctx.skill).replace(/\{dept\}/g, ctx.dept)
      .replace(/\{year\}/g, String(ctx.year)).replace(/\{company\}/g, ctx.company);
  };
  const commentDocs = [];
  for (const post of postDocs) {
    if (commentDocs.length >= MAX_COMMENTS) break;
    const hubPost = hubs.some((h) => h.id === post.authorId);
    const n = hubPost ? randInt(2, 4) : (chance(0.4) ? randInt(1, 3) : 0);
    for (const commenter of pickMany(users.filter((u) => u.id !== post.authorId), n)) {
      if (commentDocs.length >= MAX_COMMENTS) break;
      const at = new Date(Math.min(now, post.createdAt.getTime() + randInt(900, 72 * 3600) * 1000));
      commentDocs.push({
        _id: new mongoose.Types.ObjectId(),
        postId: post._id,
        authorId: commenter.id,
        content: render(pick(COMMENT_TEMPLATES), commenter),
        seedBatch: SEED_BATCH,
        createdAt: at,
        updatedAt: at,
      });
    }
  }

  // ── Reactions (capped, unique per post+user) ───────────────────────────────
  const reactionDocs = [];
  for (const post of postDocs) {
    if (reactionDocs.length >= MAX_REACTIONS) break;
    const hubPost = hubs.some((h) => h.id === post.authorId);
    const n = hubPost ? randInt(6, 14) : randInt(0, 8);
    for (const reactor of pickMany(users.filter((u) => u.id !== post.authorId), n)) {
      if (reactionDocs.length >= MAX_REACTIONS) break;
      const at = new Date(Math.min(now, post.createdAt.getTime() + randInt(120, 96 * 3600) * 1000));
      reactionDocs.push({
        _id: new mongoose.Types.ObjectId(),
        postId: post._id,
        userId: reactor.id,
        type: chance(0.68) ? 'LIKE' : 'HELPFUL',
        seedBatch: SEED_BATCH,
        createdAt: at,
        updatedAt: at,
      });
    }
  }

  // ── Size estimate ──────────────────────────────────────────────────────────
  const bytes = (docs) => docs.reduce((s, d) => s + Buffer.byteLength(JSON.stringify(d)), 0);
  const estimate = Math.round((bytes(postDocs) + bytes(commentDocs) + bytes(reactionDocs)) * 1.6); // + index/overhead margin
  console.log(`\n   plan: ${postDocs.length} posts by ${counts.size} authors, ${commentDocs.length} comments, ${reactionDocs.length} reactions`);
  console.log(`   estimated size: ${mb(estimate)} (${((estimate / ATLAS_M0_BYTES) * 100).toFixed(2)}% of the 512 MB free tier)`);

  if (!WRITE) {
    console.log('\n   Dry run: nothing was written. Re-run with --yes to write.\n');
    return;
  }

  // ── Write ──────────────────────────────────────────────────────────────────
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const col = { posts: db.collection('posts'), comments: db.collection('comments'), reactions: db.collection('reactions') };

  const stats = async () => db.command({ dbStats: 1, scale: 1 });
  const before = await stats();
  console.log(`\n   database ${db.databaseName}: ${mb(before.dataSize)} data / ${mb(before.storageSize)} storage before`);

  // Remove only what an earlier run of this script inserted.
  const removed = {
    posts: (await col.posts.deleteMany({ seedBatch: SEED_BATCH })).deletedCount,
    comments: (await col.comments.deleteMany({ seedBatch: SEED_BATCH })).deletedCount,
    reactions: (await col.reactions.deleteMany({ seedBatch: SEED_BATCH })).deletedCount,
  };
  console.log(`   removed from an earlier run: ${removed.posts} posts, ${removed.comments} comments, ${removed.reactions} reactions`);

  await col.posts.insertMany(postDocs);
  if (commentDocs.length) await col.comments.insertMany(commentDocs);
  if (reactionDocs.length) await col.reactions.insertMany(reactionDocs);

  const after = await stats();
  console.log(`   inserted ${postDocs.length} posts, ${commentDocs.length} comments, ${reactionDocs.length} reactions`);
  console.log(`   database now: ${mb(after.dataSize)} data / ${mb(after.storageSize)} storage (${((after.storageSize / ATLAS_M0_BYTES) * 100).toFixed(2)}% of 512 MB)\n`);
}

main()
  .catch((err) => { console.error('\n❌ [feed] Failed:', err.message); process.exitCode = 1; })
  .finally(async () => {
    await prisma.$disconnect();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
