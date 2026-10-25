// backend/src/services/peerMatchService.js
// "People like you": recommends peers to connect or collaborate with.
//   - Students are matched with other students.
//   - Alumni are matched with alumni and/or students (their choice).
//
// Like best-fit matching, the score is a weighted sum of signals the viewer can
// see, and every contributing signal produces a human-readable reason.

'use strict';

const { prisma } = require('../database/postgres');
const graph = require('./graphService');
const { getHiddenUserIds } = require('./visibilityService');
const { tokenise } = require('./matchService');

const WEIGHTS = {
  skillOverlap: 32,   // skills in common, weighted by how close the levels are
  interestMatch: 20,  // overlapping career interests / work focus
  mutual: 12,         // people you both know
  sameDepartment: 10, // shared academic background
  batch: 8,           // graduated around the same time
  sameCompany: 8,     // alumni working at the same company
};

const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

const LEVELS = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2, EXPERT: 3 };
const VALID_ROLES = ['ALL', 'ALUMNI', 'STUDENT'];

/** 1 when levels match, falling to 0.25 when they are three levels apart. */
function levelCloseness(a, b) {
  const la = LEVELS[String(a || '').toUpperCase()];
  const lb = LEVELS[String(b || '').toUpperCase()];
  if (la === undefined || lb === undefined) return 0.7;
  return 1 - (Math.abs(la - lb) * 0.25);
}

/**
 * Scores one candidate for one viewer. Both sides use the same profile shape:
 * { skills: [{ name, proficiency }], careerInterests, designation, bio,
 *   department, graduationYear, company, role }.
 */
function scorePeer({ viewer, peer, mutualCount = 0, explicitInterest = false }) {
  const reasons = [];
  let score = 0;

  // ─── Shared skills ────────────────────────────────────────────────────────
  const viewerSkills = new Map(viewer.skills.map((s) => [s.name.toLowerCase(), s.proficiency]));
  const shared = peer.skills.filter((s) => viewerSkills.has(s.name.toLowerCase()));

  if (shared.length) {
    const effective = shared.reduce(
      (sum, s) => sum + levelCloseness(viewerSkills.get(s.name.toLowerCase()), s.proficiency),
      0,
    );
    const ratio = Math.min(1, effective / 4);
    score += WEIGHTS.skillOverlap * ratio;
    const names = shared.map((s) => s.name);
    reasons.push({
      type: 'skills',
      weight: Math.round(WEIGHTS.skillOverlap * ratio),
      label: names.length === 1
        ? `Also works with ${names[0]}`
        : `Shares ${names.length} of your skills: ${names.slice(0, 3).join(', ')}`,
      detail: names,
    });
  }

  // ─── Interests ────────────────────────────────────────────────────────────
  // Overlap between what each side says they care about, plus the other
  // person's job title, so "Backend Engineering" finds backend people.
  const viewerTokens = new Set(tokenise(viewer.careerInterests));
  if (viewerTokens.size) {
    const peerTokens = new Set([
      ...tokenise(peer.careerInterests),
      ...tokenise(peer.designation),
    ]);
    const common = [...viewerTokens].filter((t) => peerTokens.has(t));

    const phrases = String(viewer.careerInterests)
      .toLowerCase()
      .split(/[,;/]+|\band\b/)
      .map((t) => t.trim())
      .filter((t) => t.length > 3);
    const haystack = [peer.careerInterests, peer.designation, peer.bio]
      .filter(Boolean).join(' ').toLowerCase();
    const phraseHits = phrases.filter((p) => haystack.includes(p));

    const hits = phraseHits.length ? phraseHits : common;
    if (hits.length) {
      const ratio = Math.min(1, (phraseHits.length * 1 + common.length * 0.5) / 3);
      const weight = explicitInterest ? WEIGHTS.interestMatch * 2 : WEIGHTS.interestMatch;
      score += weight * ratio;
      reasons.push({
        type: 'interests',
        weight: Math.round(weight * ratio),
        label: `Interested in ${[...new Set(hits)].slice(0, 2).join(' and ')} too`,
        detail: [...new Set(hits)],
      });
    }
  }

  // ─── Mutual connections ───────────────────────────────────────────────────
  if (mutualCount > 0) {
    const ratio = Math.min(1, mutualCount / 10);
    score += WEIGHTS.mutual * ratio;
    reasons.push({
      type: 'network',
      weight: Math.round(WEIGHTS.mutual * ratio),
      label: `${mutualCount} mutual connection${mutualCount === 1 ? '' : 's'}`,
      detail: mutualCount,
    });
  }

  // ─── Same department ──────────────────────────────────────────────────────
  if (viewer.department && peer.department === viewer.department) {
    score += WEIGHTS.sameDepartment;
    reasons.push({
      type: 'department',
      weight: WEIGHTS.sameDepartment,
      label: `Same department (${peer.department})`,
      detail: peer.department,
    });
  }

  // ─── Batch ────────────────────────────────────────────────────────────────
  if (viewer.graduationYear && peer.graduationYear) {
    const gap = Math.abs(viewer.graduationYear - peer.graduationYear);
    const ratio = gap === 0 ? 1 : gap === 1 ? 0.75 : gap === 2 ? 0.5 : gap <= 4 ? 0.25 : 0;
    if (ratio > 0) {
      score += WEIGHTS.batch * ratio;
      reasons.push({
        type: 'batch',
        weight: Math.round(WEIGHTS.batch * ratio),
        label: gap === 0
          ? `Same batch (Class of ${peer.graduationYear})`
          : `Class of ${peer.graduationYear} — ${gap} year${gap === 1 ? '' : 's'} apart`,
        detail: peer.graduationYear,
      });
    }
  }

  // ─── Same company ─────────────────────────────────────────────────────────
  if (viewer.company && peer.company
    && viewer.company.trim().toLowerCase() === peer.company.trim().toLowerCase()) {
    score += WEIGHTS.sameCompany;
    reasons.push({
      type: 'company',
      weight: WEIGHTS.sameCompany,
      label: `Also at ${peer.company}`,
      detail: peer.company,
    });
  }

  // A skill or interest match always leads, so the headline reason explains
  // why the person was suggested.
  const RELEVANCE_FIRST = { skills: 0, interests: 0 };
  reasons.sort((a, b) => {
    const rank = (x) => (x.type in RELEVANCE_FIRST ? 0 : 1);
    return rank(a) - rank(b) || b.weight - a.weight;
  });

  const ceiling = explicitInterest ? MAX_SCORE + WEIGHTS.interestMatch : MAX_SCORE;
  return { score: Math.min(100, Math.round((score / ceiling) * 100)), reasons };
}

function toProfile(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    department: user.academicProfile?.department?.code || null,
    departmentName: user.academicProfile?.department?.name || null,
    graduationYear: user.academicProfile?.graduationYear || null,
    bio: user.academicProfile?.bio || '',
    careerInterests: user.academicProfile?.careerInterests || '',
    company: user.alumniProfile?.company?.name || null,
    designation: user.alumniProfile?.designation || null,
    experienceYears: user.alumniProfile?.experienceYears || null,
    skills: user.userSkills.map((us) => ({
      name: us.skill.name,
      proficiency: us.proficiency,
    })),
  };
}

/**
 * Recommends peers for a student or alumnus.
 *
 * @param {string} viewerId
 * @param {'STUDENT'|'ALUMNI'} viewerRole
 * @param {{ limit?: number, role?: string, skillId?: string, departmentId?: string,
 *           companyId?: string, interest?: string }} filters
 *   `role` is honoured for alumni only; students always see other students.
 */
async function recommendPeers(viewerId, viewerRole, filters = {}) {
  const { limit = 12, skillId, departmentId, companyId, interest } = filters;

  const viewerRecord = await prisma.user.findUnique({
    where: { id: viewerId },
    include: {
      academicProfile: { include: { department: true } },
      alumniProfile: { include: { company: true } },
      userSkills: { include: { skill: true } },
    },
  });

  if (!viewerRecord) {
    return { profile: null, recommendations: [], profileComplete: false };
  }

  const viewer = toProfile(viewerRecord);
  // An explicit interest from the search box overrides the stored one.
  if (interest) viewer.careerInterests = interest;

  const profileComplete = viewer.skills.length > 0 || Boolean(viewer.careerInterests);

  // Which roles may this viewer see?
  const requested = String(filters.role || 'ALL').toUpperCase();
  const roleFilter = VALID_ROLES.includes(requested) ? requested : 'ALL';
  const roles = viewerRole === 'STUDENT'
    ? ['STUDENT']
    : roleFilter === 'ALL' ? ['ALUMNI', 'STUDENT'] : [roleFilter];

  // ─── Exclusions: self, connections, pending requests, hidden profiles ─────
  const [connections, requests, hidden] = await Promise.all([
    prisma.connection.findMany({
      where: { OR: [{ userA: viewerId }, { userB: viewerId }] },
      select: { userA: true, userB: true },
    }),
    prisma.connectionRequest.findMany({
      where: { status: 'PENDING', OR: [{ senderId: viewerId }, { receiverId: viewerId }] },
      select: { senderId: true, receiverId: true },
    }),
    getHiddenUserIds(viewerId, viewerRole),
  ]);

  const excluded = new Set([viewerId, ...hidden]);
  for (const c of connections) excluded.add(c.userA === viewerId ? c.userB : c.userA);
  for (const r of requests) excluded.add(r.senderId === viewerId ? r.receiverId : r.senderId);

  // ─── Candidates ───────────────────────────────────────────────────────────
  // Alumni must be admin-verified; a company filter only applies to alumni.
  const roleClauses = [];
  if (roles.includes('STUDENT') && !companyId) roleClauses.push({ role: 'STUDENT' });
  if (roles.includes('ALUMNI')) {
    roleClauses.push({
      role: 'ALUMNI',
      alumniProfile: {
        is: { verificationStatus: 'APPROVED', ...(companyId ? { companyId } : {}) },
      },
    });
  }

  if (!roleClauses.length) {
    return { profile: viewer, profileComplete, recommendations: [], totalMatched: 0 };
  }

  const where = {
    status: 'ACTIVE',
    id: { notIn: [...excluded] },
    OR: roleClauses,
  };
  if (departmentId) where.academicProfile = { is: { departmentId } };
  if (skillId) where.userSkills = { some: { skillId } };

  const candidates = await prisma.user.findMany({
    where,
    include: {
      academicProfile: { include: { department: true } },
      alumniProfile: { include: { company: true } },
      userSkills: { include: { skill: true } },
    },
    // Scoring happens in memory, so cap the pool rather than the result.
    take: 400,
  });

  // ─── Mutual connections (optional: graph may be disabled) ─────────────────
  const mutualCounts = new Map();
  if (graph.isGraphEnabled()) {
    try {
      const suggestions = await graph.getSuggestions(viewerId, { limit: 300 });
      for (const s of suggestions) mutualCounts.set(s.user.id, s.mutualCount);
    } catch (err) {
      console.error('[peers] mutual connections unavailable:', err.message);
    }
  }

  // ─── Score and rank ───────────────────────────────────────────────────────
  const scored = candidates.map((c) => {
    const peer = toProfile(c);
    const mutualCount = Number(mutualCounts.get(c.id)) || 0;
    const { score, reasons } = scorePeer({
      viewer,
      peer,
      mutualCount,
      explicitInterest: Boolean(interest),
    });

    return {
      user: {
        id: peer.id,
        name: peer.name,
        role: peer.role,
        department: peer.department,
        departmentName: peer.departmentName,
        graduationYear: peer.graduationYear,
        company: peer.company,
        designation: peer.designation,
        skills: peer.skills.map((s) => s.name),
      },
      score,
      reasons,
      mutualConnections: mutualCount,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name));

  // A typed search drops anyone who does not match it on skills or interests.
  const relevant = interest
    ? scored.filter((r) => r.reasons.some(
      (x) => (x.type === 'skills' || x.type === 'interests') && x.weight > 0,
    ))
    : scored;

  return {
    profile: viewer,
    profileComplete,
    recommendations: relevant.slice(0, limit),
    searchApplied: Boolean(interest),
    totalMatched: relevant.length,
    graphEnabled: graph.isGraphEnabled(),
  };
}

module.exports = { recommendPeers, scorePeer, WEIGHTS, MAX_SCORE };
