// backend/prisma/seed-content.js
// Fills in the campus content layer: completes any missing user profiles so
// posts can reference real companies and departments, then regenerates the
// community feed (posts, comments, reactions) in MongoDB.
//
// Idempotent: posts/comments/reactions are cleared and rebuilt on each run.
// Accounts are never deleted, and existing profile values are never overwritten.
//
// Usage: npm run db:seed:content

'use strict';

const nodeCrypto = require('crypto');
if (!global.crypto) {
  global.crypto = nodeCrypto.webcrypto || nodeCrypto;
}

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');

const {
  DEPARTMENTS, DEPT_SKILLS, DEPT_TRACK, DESIGNATIONS, TRACK_COMPANIES,
  COMPANY_CONTEXT, DEPT_FOCUS, UNIVERSAL_FOCUS,
  CAREER_INTERESTS, PROFICIENCIES,
} = require('./seed-data/reference');
const {
  ALUMNI_TEMPLATES, STUDENT_TEMPLATES, CAMPUS_TEMPLATES, COMMENT_TEMPLATES,
} = require('./seed-data/posts');

const prisma = new PrismaClient();

// ─── Tunables ────────────────────────────────────────────────────────────────

const POSTS_PER_PERSON = 5;        // baseline for everyone
const ACTIVE_POSTER_BONUS = [6, 14]; // extra posts for the most active users
const ACTIVE_POSTER_FRACTION = 0.18; // ~18% of campus posts a lot more
const HUB_BONUS = [10, 18];        // extra posts for the named hub users
const POST_WINDOW_DAYS = 150;      // spread across the last ~5 months
const CURRENT_YEAR = 2026;

// Named users who should look especially active.
const HUB_MATCHERS = ['aravind', 'balamuthukrishnan', 'oviya', 'pooja'];

// ─── Deterministic RNG (mulberry32) ──────────────────────────────────────────
// Seeded so re-runs produce the same feed, which keeps the data reviewable.

let rngState = 20261018;
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
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}
function dateWithin(days) {
  return new Date(Date.now() - Math.floor(rand() * days * 24 * 3600 * 1000));
}

// ─── Stage 1: complete missing profiles ──────────────────────────────────────
// The feed is only as real as the profiles behind it: a post can't mention an
// author's company if the author has no alumni profile.

async function completeProfiles() {
  console.log('🧩 [content] Completing missing profiles...');

  const departments = {};
  for (const d of DEPARTMENTS) {
    departments[d.code] = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: d,
    });
  }

  // Cache companies and skills by name so we only upsert what we need.
  const companyCache = new Map();
  async function companyByName(name) {
    if (companyCache.has(name)) return companyCache.get(name);
    const nameKey = name.toLowerCase().trim();
    const rec = await prisma.company.upsert({
      where: { nameKey }, update: { name }, create: { name, nameKey },
    });
    companyCache.set(name, rec);
    return rec;
  }
  const skillCache = new Map();
  async function skillByName(name) {
    if (skillCache.has(name)) return skillCache.get(name);
    const rec = await prisma.skill.upsert({ where: { name }, update: {}, create: { name } });
    skillCache.set(name, rec);
    return rec;
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'ALUMNI'] } },
    include: { academicProfile: true, alumniProfile: true, userSkills: true, userSettings: true },
  });

  let academicAdded = 0;
  let alumniAdded = 0;
  let skillsAdded = 0;
  let settingsAdded = 0;

  for (const user of users) {
    // Department: keep an existing one, else assign a stable pseudo-random one.
    let deptCode = null;
    if (user.academicProfile) {
      deptCode = Object.values(departments)
        .find((d) => d.id === user.academicProfile.departmentId)?.code || null;
    }
    if (!deptCode) deptCode = pick(DEPARTMENTS).code;

    const graduationYear = user.academicProfile?.graduationYear
      || (user.role === 'STUDENT' ? randInt(2026, 2029) : randInt(2015, 2025));

    const track = DEPT_TRACK[deptCode] || 'software';
    const skillPool = DEPT_SKILLS[deptCode] || DEPT_SKILLS.CSE;

    if (!user.academicProfile) {
      const chosen = pickMany(skillPool, 2);
      await prisma.academicProfile.create({
        data: {
          userId: user.id,
          departmentId: departments[deptCode].id,
          graduationYear,
          bio: user.role === 'ALUMNI'
            ? `SSN ${deptCode} ${graduationYear} graduate. Happy to help juniors with interview preparation and career decisions.`
            : `${deptCode} student at SSN, class of ${graduationYear}. Currently working with ${chosen.join(' and ')}.`,
          careerInterests: pickMany(CAREER_INTERESTS, 3).join(', '),
        },
      });
      academicAdded += 1;
    }

    // Alumni need a company and designation for company-specific posts to work.
    if (user.role === 'ALUMNI' && !user.alumniProfile?.companyId) {
      const band = pick(DESIGNATIONS[track]);
      const yearsOut = Math.max(0.5, CURRENT_YEAR - graduationYear);
      const experienceYears = Number(
        Math.min(band.max, Math.max(band.min, Math.min(yearsOut, band.max))).toFixed(1),
      );
      const company = await companyByName(pick(TRACK_COMPANIES[track]));
      const status = user.alumniProfile?.verificationStatus || (chance(0.88) ? 'APPROVED' : 'PENDING');

      await prisma.alumniProfile.upsert({
        where: { userId: user.id },
        update: {
          companyId: company.id,
          designation: user.alumniProfile?.designation || band.title,
          experienceYears: user.alumniProfile?.experienceYears ?? experienceYears,
          verificationStatus: status,
          verifiedAt: status === 'APPROVED' ? (user.alumniProfile?.verifiedAt || dateWithin(300)) : null,
        },
        create: {
          userId: user.id,
          companyId: company.id,
          designation: band.title,
          experienceYears,
          verificationStatus: status,
          verifiedAt: status === 'APPROVED' ? dateWithin(300) : null,
        },
      });
      alumniAdded += 1;
    }

    // Skills, so posts can reference what the author actually knows.
    if (user.userSkills.length === 0) {
      for (const name of pickMany(skillPool, randInt(4, 7))) {
        const skill = await skillByName(name);
        await prisma.userSkill.create({
          data: {
            userId: user.id,
            skillId: skill.id,
            proficiency: user.role === 'ALUMNI'
              ? pick(['INTERMEDIATE', 'ADVANCED', 'ADVANCED'])
              : pick(PROFICIENCIES),
          },
        }).catch(() => {});
      }
      skillsAdded += 1;
    }

    if (!user.userSettings) {
      await prisma.userSettings.create({
        data: {
          userId: user.id,
          profileVisibility: 'COLLEGE',
          notificationPreferences: {
            connection_requests: true,
            messages: true,
            mentorship_requests: true,
            community_activity: chance(0.5),
          },
        },
      }).catch(() => {});
      settingsAdded += 1;
    }
  }

  console.log(`  ✓ academic profiles added: ${academicAdded}, alumni profiles: ${alumniAdded}, skill sets: ${skillsAdded}, settings: ${settingsAdded}`);
}

// ─── Stage 2: generate the feed ──────────────────────────────────────────────

function buildContext(user, allAlumni) {
  const dept = user.academicProfile?.department?.code || 'CSE';
  const deptName = user.academicProfile?.department?.name || 'Computer Science and Engineering';
  const track = DEPT_TRACK[dept] || 'software';

  const ownSkills = (user.userSkills || []).map((us) => us.skill.name);
  const pool = ownSkills.length >= 3 ? ownSkills : (DEPT_SKILLS[dept] || DEPT_SKILLS.CSE);
  const [skill, skill2, skill3] = pickMany(pool, 3);

  const company = user.alumniProfile?.company?.name || pick(TRACK_COMPANIES[track]);
  const ctxInfo = COMPANY_CONTEXT[company] || { domain: 'large-scale engineering systems', scale: 'significant production load' };
  let otherCompany = pick(TRACK_COMPANIES[track]);
  if (otherCompany === company) otherCompany = pick(TRACK_COMPANIES[track].filter((c) => c !== company)) || otherCompany;

  return {
    name: user.name,
    firstName: user.name.split(' ')[0],
    role: user.role,
    dept,
    deptName,
    year: user.academicProfile?.graduationYear || CURRENT_YEAR,
    company,
    otherCompany,
    designation: user.alumniProfile?.designation || pick(DESIGNATIONS[track]).title,
    domain: ctxInfo.domain,
    scale: ctxInfo.scale,
    skill: skill || 'System Design',
    skill2: skill2 || 'Data Structures',
    skill3: skill3 || 'Linux',
    // Focus must suit the author's discipline, or a CIVIL student ends up
    // posting a frontend resource list.
    focus: pick([...(DEPT_FOCUS[dept] || DEPT_FOCUS.CSE), ...UNIVERSAL_FOCUS]),
    mentorName: pick(allAlumni)?.name?.split(' ')[0] || 'the seniors here',
    n: randInt(8, 45),
  };
}

async function seedFeed() {
  console.log('📝 [content] Building the feed...');

  const users = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'ALUMNI'] }, status: 'ACTIVE' },
    include: {
      academicProfile: { include: { department: true } },
      alumniProfile: { include: { company: true } },
      userSkills: { include: { skill: true } },
    },
  });

  const alumni = users.filter((u) => u.role === 'ALUMNI');
  const isHub = (u) => HUB_MATCHERS.some(
    (m) => u.name.toLowerCase().includes(m) || u.email.toLowerCase().includes(m),
  );
  const hubs = users.filter(isHub);
  console.log(`  · ${users.length} authors (${alumni.length} alumni) · hubs: ${hubs.map((h) => h.name).join(', ') || 'none found'}`);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27018/seniorsos';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  }
  const Post = require('../src/database/mongodb/models/Post.model');
  const Comment = require('../src/database/mongodb/models/Comment.model');
  const Reaction = require('../src/database/mongodb/models/Reaction.model');

  const before = await Post.countDocuments();
  await Promise.all([Post.deleteMany({}), Comment.deleteMany({}), Reaction.deleteMany({})]);
  console.log(`  · cleared ${before} existing posts (and their comments/reactions)`);

  // Decide how many posts each person writes.
  const activeSet = new Set(
    pickMany(users, Math.round(users.length * ACTIVE_POSTER_FRACTION)).map((u) => u.id),
  );

  const postDocs = [];
  for (const user of users) {
    let count = POSTS_PER_PERSON;
    if (activeSet.has(user.id)) count += randInt(...ACTIVE_POSTER_BONUS);
    if (isHub(user)) count += randInt(...HUB_BONUS);

    // Avoid repeating the same template for one author.
    const family = user.role === 'ALUMNI' ? ALUMNI_TEMPLATES : STUDENT_TEMPLATES;
    const usedTemplates = new Set();

    for (let i = 0; i < count; i += 1) {
      const ctx = buildContext(user, alumni);

      // Mostly role-appropriate posts, with occasional campus-wide ones.
      const useCampus = chance(0.15);
      const sourceList = useCampus ? CAMPUS_TEMPLATES : family;

      // Pick an unused template where possible so an author doesn't repeat.
      let idx = Math.floor(rand() * sourceList.length);
      for (let tries = 0; tries < sourceList.length; tries += 1) {
        const key = `${useCampus ? 'c' : 'f'}${idx}`;
        if (!usedTemplates.has(key)) { usedTemplates.add(key); break; }
        idx = (idx + 1) % sourceList.length;
      }

      const { content, tags } = sourceList[idx](ctx);
      const createdAt = dateWithin(POST_WINDOW_DAYS);

      postDocs.push({
        authorId: user.id,
        content,
        media: [],
        tags: [...new Set(tags.filter(Boolean).map((t) => String(t).toLowerCase()))].slice(0, 10),
        // Mostly campus-wide; some connections-only to exercise that path.
        visibility: chance(0.86) ? 'COLLEGE' : 'CONNECTIONS',
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  const posts = await Post.insertMany(postDocs);
  console.log(`  ✓ ${posts.length} posts created`);

  // ─── Comments ────────────────────────────────────────────────────────────

  function renderComment(tpl, commenter) {
    const ctx = buildContext(commenter, alumni);
    return tpl
      .replace(/\{skill\}/g, ctx.skill)
      .replace(/\{dept\}/g, ctx.dept)
      .replace(/\{year\}/g, String(ctx.year))
      .replace(/\{company\}/g, ctx.company);
  }

  const commentDocs = [];
  const now = Date.now();
  for (const post of posts) {
    const hubPost = hubs.some((h) => h.id === post.authorId);
    // Many posts get no comments at all, like a real feed.
    const count = hubPost ? randInt(2, 8) : (chance(0.5) ? randInt(1, 5) : 0);
    if (!count) continue;

    for (const commenter of pickMany(users.filter((u) => u.id !== post.authorId), count)) {
      const at = Math.min(now, post.createdAt.getTime() + randInt(900, 96 * 3600) * 1000);
      commentDocs.push({
        postId: post._id,
        authorId: commenter.id,
        content: renderComment(pick(COMMENT_TEMPLATES), commenter),
        createdAt: new Date(at),
        updatedAt: new Date(at),
      });
    }
  }
  if (commentDocs.length) await Comment.insertMany(commentDocs);
  console.log(`  ✓ ${commentDocs.length} comments created`);

  // ─── Reactions (unique per post+user) ────────────────────────────────────

  const reactionDocs = [];
  for (const post of posts) {
    const hubPost = hubs.some((h) => h.id === post.authorId);
    const count = hubPost ? randInt(14, 50) : randInt(1, 26);
    for (const reactor of pickMany(users.filter((u) => u.id !== post.authorId), count)) {
      const at = Math.min(now, post.createdAt.getTime() + randInt(120, 120 * 3600) * 1000);
      reactionDocs.push({
        postId: post._id,
        userId: reactor.id,
        // HELPFUL fits a mentorship network; keep LIKE dominant.
        type: chance(0.68) ? 'LIKE' : 'HELPFUL',
        createdAt: new Date(at),
        updatedAt: new Date(at),
      });
    }
  }
  if (reactionDocs.length) {
    await Reaction.insertMany(reactionDocs, { ordered: false }).catch((err) => {
      // Duplicate (postId,userId) pairs are expected and skipped.
      if (err.code !== 11000 && !err.writeErrors) throw err;
    });
  }
  const reactionCount = await Reaction.countDocuments();
  console.log(`  ✓ ${reactionCount} reactions created`);

  return { posts: posts.length, comments: commentDocs.length, reactions: reactionCount, users: users.length, hubs };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 [content] Seeding SeniorSOS community content\n');
  const started = Date.now();

  await completeProfiles();
  const result = await seedFeed();

  const Post = require('../src/database/mongodb/models/Post.model');
  const Comment = require('../src/database/mongodb/models/Comment.model');

  console.log('\n📊 [content] Summary');
  console.log(`   Authors      ${result.users}`);
  console.log(`   Posts        ${result.posts}  (~${(result.posts / result.users).toFixed(1)} per person)`);
  console.log(`   Comments     ${result.comments}`);
  console.log(`   Reactions    ${result.reactions}`);

  console.log('\n🔗 Most active authors');
  const top = await Post.aggregate([
    { $group: { _id: '$authorId', posts: { $sum: 1 } } },
    { $sort: { posts: -1 } },
    { $limit: 8 },
  ]);
  const names = new Map(
    (await prisma.user.findMany({
      where: { id: { in: top.map((t) => t._id) } },
      select: { id: true, name: true, role: true },
    })).map((u) => [u.id, u]),
  );
  for (const row of top) {
    const u = names.get(row._id);
    const comments = await Comment.countDocuments({ authorId: row._id });
    console.log(`   ${(u?.name || row._id).padEnd(26)} ${String(row.posts).padStart(2)} posts, ${comments} comments written  [${u?.role || '?'}]`);
  }

  console.log(`\n✅ [content] Done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}

main()
  .catch((err) => {
    console.error('\n❌ [content] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
