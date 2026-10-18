// backend/src/services/matchService.js
// Scores verified alumni against a student's profile to answer "who should I
// talk to?" — the question project.md opens with.
//
// The score is a weighted sum of signals the student can see on the card, so
// every recommendation can explain itself. Nothing is a black box: each
// component that contributes also produces a human-readable reason.

'use strict';

const { prisma } = require('../database/postgres');
const graph = require('./graphService');

// Weights. Shared skills and interests matter most, because they are what the
// student actually wants to talk about; the network signal breaks ties.
const WEIGHTS = {
  skillOverlap: 34,      // skills in common
  interestMatch: 28,     // their work matches the student's stated interests
  mutualConnections: 12, // reachable through people you know
  sameDepartment: 10,    // shared academic background
  seniority: 8,          // enough experience to actually advise
  recency: 5,            // graduated recently enough to remember the process
  verified: 3,           // verified alumni are a safer bet
};

const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

// Words that appear in almost every interest and job title, so matching on
// them produces noise: "Cloud Systems" should not match a manufacturing
// engineer because both contain "systems".
const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'engineering', 'engineer', 'systems', 'system',
  'development', 'developer', 'technology', 'technologies', 'software',
  'senior', 'associate', 'lead', 'staff', 'principal', 'manager', 'management',
  'work', 'working', 'role', 'roles', 'team', 'teams', 'experience',
]);

/** Normalises free text into comparable tokens, dropping generic words. */
function tokenise(text, { keepGeneric = false } = {}) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 2 && (keepGeneric || !STOPWORDS.has(t)));
}

/**
 * Scores one alumnus for one student.
 * Returns the score out of 100 plus the reasons behind it.
 */
function scoreAlumnus({ student, alumnus, mutualCount, currentYear, explicitInterest = false }) {
  const reasons = [];
  let score = 0;

  // ─── Shared skills ────────────────────────────────────────────────────────
  // A typed query stands in for the student's skills: someone searching
  // "machine learning" wants ML people, not people who share their own
  // current stack.
  const querySkills = explicitInterest
    ? new Set(tokenise(student.careerInterests))
    : null;

  const studentSkills = new Set(student.skills.map((s) => s.toLowerCase()));
  const shared = querySkills
    ? alumnus.skills.filter((skill) => {
      const parts = tokenise(skill);
      return parts.length > 0 && parts.every((t) => querySkills.has(t));
    })
    : alumnus.skills.filter((s) => studentSkills.has(s.toLowerCase()));

  if (shared.length && (querySkills ? querySkills.size : studentSkills.size)) {
    // Scale with the number of genuinely shared skills. Dividing by the
    // student's own skill count let someone with two matches out of two
    // score full marks, which over-rewarded thin profiles.
    const ratio = Math.min(1, shared.length / 4);
    score += WEIGHTS.skillOverlap * ratio;
    reasons.push({
      type: 'skills',
      weight: Math.round(WEIGHTS.skillOverlap * ratio),
      label: querySkills
        ? `Skilled in ${shared.slice(0, 3).join(', ')}`
        : shared.length === 1
          ? `Also works with ${shared[0]}`
          : `Shares ${shared.length} of your skills: ${shared.slice(0, 3).join(', ')}`,
      detail: shared,
    });
  }

  // ─── Career interests vs their actual role ────────────────────────────────
  // A student interested in "Backend Engineering" should surface backend
  // engineers, so match interest tokens against designation, company and bio.
  const interestTokens = new Set(tokenise(student.careerInterests));
  if (interestTokens.size) {
    // What they do day to day carries the most signal, so weight a hit in
    // the job title above one buried in a bio.
    const titleHits = [...new Set(
      tokenise(alumnus.designation).filter((t) => interestTokens.has(t)),
    )];
    // Match the phrase, not loose tokens: "machine learning" should not hit a
    // manufacturing bio because it contains the word "machine".
    const haystack = [alumnus.bio, alumnus.skills.join(' '), alumnus.company]
      .filter(Boolean).join(' ').toLowerCase();
    const phrases = String(student.careerInterests)
      .toLowerCase()
      .split(/[,;/]+|\band\b/)
      .map((t) => t.trim())
      .filter((t) => t.length > 3);

    const otherHits = [...new Set(
      phrases.filter((phrase) => haystack.includes(phrase) && !titleHits.includes(phrase)),
    )];

    if (titleHits.length || otherHits.length) {
      const ratio = Math.min(1, (titleHits.length * 1 + otherHits.length * 0.35) / 2);
      // A typed search is the student's actual question, so let it outweigh
      // their stored skill profile instead of merely nudging the order.
      const weight = explicitInterest ? WEIGHTS.interestMatch * 2 : WEIGHTS.interestMatch;
      score += weight * ratio;
      const shown = (titleHits.length ? titleHits : otherHits).slice(0, 2);
      reasons.push({
        type: 'interests',
        weight: Math.round(weight * ratio),
        label: titleHits.length
          ? `Works in ${shown.join(' and ')} — matches your interests`
          : `Background in ${shown.join(' and ')}`,
        detail: [...titleHits, ...otherHits],
      });
    }
  }

  // ─── Mutual connections ───────────────────────────────────────────────────
  if (mutualCount > 0) {
    // Saturating at 5 made this a near-constant bonus once the network got
    // dense (average degree is ~27), so it stopped separating candidates.
    const ratio = Math.min(1, mutualCount / 20);
    score += WEIGHTS.mutualConnections * ratio;
    reasons.push({
      type: 'network',
      weight: Math.round(WEIGHTS.mutualConnections * ratio),
      label: `${mutualCount} mutual connection${mutualCount === 1 ? '' : 's'}`,
      detail: mutualCount,
    });
  }

  // ─── Same department ──────────────────────────────────────────────────────
  if (student.department && alumnus.department === student.department) {
    score += WEIGHTS.sameDepartment;
    reasons.push({
      type: 'department',
      weight: WEIGHTS.sameDepartment,
      label: `Same department (${alumnus.department})`,
      detail: alumnus.department,
    });
  }

  // ─── Seniority ────────────────────────────────────────────────────────────
  // Enough experience to give useful advice, without being so senior that the
  // graduate-hiring process is a distant memory.
  const years = Number(alumnus.experienceYears) || 0;
  if (years >= 1) {
    const ratio = years >= 8 ? 0.7 : Math.min(1, years / 6);
    score += WEIGHTS.seniority * ratio;
    reasons.push({
      type: 'experience',
      weight: Math.round(WEIGHTS.seniority * ratio),
      label: `${years} year${years === 1 ? '' : 's'} of industry experience`,
      detail: years,
    });
  }

  // ─── Recency ──────────────────────────────────────────────────────────────
  // Someone who graduated 2-8 years ago remembers the placement process.
  const yearsOut = alumnus.graduationYear ? currentYear - alumnus.graduationYear : null;
  if (yearsOut !== null && yearsOut >= 0 && yearsOut <= 8) {
    const ratio = yearsOut <= 5 ? 1 : 0.6;
    score += WEIGHTS.recency * ratio;
    reasons.push({
      type: 'recency',
      weight: Math.round(WEIGHTS.recency * ratio),
      label: `Graduated ${alumnus.graduationYear} — recent enough to know the process`,
      detail: alumnus.graduationYear,
    });
  }

  // ─── Verified ─────────────────────────────────────────────────────────────
  if (alumnus.verificationStatus === 'APPROVED') {
    score += WEIGHTS.verified;
    reasons.push({
      type: 'verified',
      weight: WEIGHTS.verified,
      label: 'Verified alumni',
      detail: true,
    });
  }

  // Strongest reasons first, except that a skill or interest match always
  // leads: showing "18 mutual connections" as the headline reason for a
  // machine-learning search hides why the person was actually returned.
  const RELEVANCE_FIRST = { skills: 0, interests: 0 };
  reasons.sort((a, b) => {
    const rank = (x) => (x.type in RELEVANCE_FIRST ? 0 : 1);
    return rank(a) - rank(b) || b.weight - a.weight;
  });

  // The ceiling rises when an explicit interest doubles that component, so
  // normalise against the matching maximum to keep the score out of 100.
  const ceiling = explicitInterest ? MAX_SCORE + WEIGHTS.interestMatch : MAX_SCORE;
  return {
    score: Math.min(100, Math.round((score / ceiling) * 100)),
    reasons,
  };
}

/**
 * Recommends alumni for a student.
 *
 * @param {string} studentId
 * @param {{ limit?: number, companyId?: string, departmentId?: string,
 *           skillId?: string, interest?: string }} filters
 */
async function recommendAlumni(studentId, filters = {}) {
  const { limit = 12, companyId, departmentId, skillId, interest } = filters;
  const currentYear = new Date().getFullYear();

  // ─── The student we are matching for ──────────────────────────────────────
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: {
      academicProfile: { include: { department: true } },
      userSkills: { include: { skill: true } },
    },
  });

  if (!student) {
    return { profile: null, recommendations: [], profileComplete: false };
  }

  const studentProfile = {
    id: student.id,
    department: student.academicProfile?.department?.code || null,
    graduationYear: student.academicProfile?.graduationYear || null,
    // An explicit interest from the search box overrides the stored one.
    careerInterests: interest || student.academicProfile?.careerInterests || '',
    skills: student.userSkills.map((us) => us.skill.name),
  };

  // A student with no skills and no interests cannot be matched meaningfully.
  const profileComplete = studentProfile.skills.length > 0
    || Boolean(studentProfile.careerInterests);

  // ─── Candidate alumni ─────────────────────────────────────────────────────
  // Exclude anyone already connected or with a request in flight: the point
  // is to suggest someone new to reach out to.
  const [connections, requests] = await Promise.all([
    prisma.connection.findMany({
      where: { OR: [{ userA: studentId }, { userB: studentId }] },
      select: { userA: true, userB: true },
    }),
    prisma.connectionRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [{ senderId: studentId }, { receiverId: studentId }],
      },
      select: { senderId: true, receiverId: true },
    }),
  ]);

  const excluded = new Set([studentId]);
  for (const c of connections) excluded.add(c.userA === studentId ? c.userB : c.userA);
  for (const r of requests) excluded.add(r.senderId === studentId ? r.receiverId : r.senderId);

  const where = {
    role: 'ALUMNI',
    status: 'ACTIVE',
    id: { notIn: [...excluded] },
    // Only alumni the admin has vetted are recommended.
    alumniProfile: { is: { verificationStatus: 'APPROVED' } },
  };
  if (companyId) where.alumniProfile = { is: { verificationStatus: 'APPROVED', companyId } };
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

  if (!candidates.length) {
    return { profile: studentProfile, profileComplete, recommendations: [] };
  }

  // ─── Mutual connection counts, in one graph query ─────────────────────────
  let mutualCounts = {};
  if (graph.isGraphEnabled()) {
    try {
      // getMutualCounts is a single Cypher query over all candidates.
      mutualCounts = await graph.getMutualCounts(
        studentId,
        candidates.slice(0, 100).map((c) => c.id),
      );
    } catch (err) {
      // The graph is an enhancement here, not a requirement.
      console.error('[match] mutual counts unavailable:', err.message);
    }
  }

  // ─── Score ────────────────────────────────────────────────────────────────
  const scored = candidates.map((c) => {
    const alumnus = {
      id: c.id,
      name: c.name,
      department: c.academicProfile?.department?.code || null,
      departmentName: c.academicProfile?.department?.name || null,
      graduationYear: c.academicProfile?.graduationYear || null,
      bio: c.academicProfile?.bio || '',
      company: c.alumniProfile?.company?.name || null,
      designation: c.alumniProfile?.designation || null,
      experienceYears: c.alumniProfile?.experienceYears || null,
      verificationStatus: c.alumniProfile?.verificationStatus || null,
      skills: c.userSkills.map((us) => us.skill.name),
    };

    const { score, reasons } = scoreAlumnus({
      student: studentProfile,
      alumnus,
      mutualCount: mutualCounts[c.id] || 0,
      currentYear,
      explicitInterest: Boolean(interest),
    });

    return { user: alumnus, score, reasons, mutualConnections: mutualCounts[c.id] || 0 };
  });

  scored.sort((a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name));

  // When the student searched for something specific, drop anyone who does
  // not match it on skills or role. Returning "18 mutual connections" as the
  // reason for a machine-learning search is worse than returning nothing.
  const relevant = interest
    ? scored.filter((r) => r.reasons.some(
      (x) => (x.type === 'skills' || x.type === 'interests') && x.weight > 0,
    ))
    : scored;

  return {
    profile: studentProfile,
    profileComplete,
    recommendations: relevant.slice(0, limit),
    // Tells the UI to say "no matches" rather than silently showing fewer.
    searchApplied: Boolean(interest),
    totalMatched: relevant.length,
    graphEnabled: graph.isGraphEnabled(),
  };
}

module.exports = { recommendAlumni, scoreAlumnus, WEIGHTS, MAX_SCORE };
