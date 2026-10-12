// backend/src/modules/auth/repositories/auth.repository.js
// All database queries for the auth module.
// Only this file imports { prisma }. Controllers and services must not.
// Returns plain objects / null — no HTTP concepts here.

'use strict';

const { prisma } = require('../../../database/postgres');

// ─── User queries ─────────────────────────────────────────────────────────────

/**
 * Find a user by email (normalised).
 * Includes the academic profile so registration can detect duplicates early.
 */
async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      academicProfile: {
        include: { department: true },
      },
      alumniProfile: true,
    },
  });
}

/**
 * Find a user by ID. Includes profiles and skills for the /me response.
 */
async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      academicProfile: {
        include: { department: true },
      },
      alumniProfile: {
        include: { company: true },
      },
      userSkills: {
        include: { skill: true },
      },
    },
  });
}

// ─── Department helper ───────────────────────────────────────────────────────

/**
 * Resolves a department by ID, code, or name.
 * If no matching department exists, auto-creates it.
 *
 * @param {string} input  UUID, code (e.g. 'IT'), or name (e.g. 'Information Technology')
 * @returns {Promise<string>}  The resolved Department UUID
 */
async function resolveDepartmentId(input) {
  if (!input) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);

  if (isUuid) {
    const existing = await prisma.department.findUnique({ where: { id: input } });
    if (existing) return existing.id;
  }

  // Try finding by code or name
  const byCodeOrName = await prisma.department.findFirst({
    where: {
      OR: [
        { code: input.toUpperCase().trim() },
        { name: { equals: input.trim(), mode: 'insensitive' } },
      ],
    },
  });

  if (byCodeOrName) {
    return byCodeOrName.id;
  }

  // Auto-create department if missing
  const cleanCode = (input.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'DEPT') + '_' + Math.floor(Math.random() * 1000);
  const newDept = await prisma.department.create({
    data: {
      code: cleanCode,
      name: input.trim(),
    },
  });

  return newDept.id;
}

// ─── Registration (one Prisma transaction) ────────────────────────────────────

/**
 * Create a new STUDENT user.
 * One transaction: user + academic_profile + user_settings.
 * Per PDF §3.2: ADMIN needs neither profile row; STUDENT needs academic_profile.
 *
 * @param {{name, email, passwordHash, departmentId, graduationYear, bio, careerInterests}} data
 */
async function createStudent({ name, email, passwordHash, departmentId, graduationYear, bio, careerInterests }) {
  return prisma.user.create({
    data: {
      name,
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'STUDENT',
      // Nested create: academic_profile in the same transaction
      academicProfile: {
        create: {
          departmentId,
          graduationYear,
          bio: bio || null,
          careerInterests: careerInterests || null,
        },
      },
      // Nested create: user_settings with defaults
      userSettings: {
        create: {},
      },
    },
    include: {
      academicProfile: { include: { department: true } },
      userSettings: true,
    },
  });
}

/**
 * Create a new ALUMNI user.
 * One transaction: user + academic_profile + alumni_profile + user_settings.
 * Per PDF §3.2: creating a user with role ALUMNI must create the alumni_profiles row
 * in the same transaction (a Prisma nested create does this).
 *
 * @param {{name, email, passwordHash, departmentId, graduationYear, bio,
 *          careerInterests, companyId, designation, experienceYears}} data
 */
async function createAlumni({
  name,
  email,
  passwordHash,
  departmentId,
  graduationYear,
  bio,
  careerInterests,
  companyId,
  designation,
  experienceYears,
}) {
  return prisma.user.create({
    data: {
      name,
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'ALUMNI',
      academicProfile: {
        create: {
          departmentId,
          graduationYear,
          bio: bio || null,
          careerInterests: careerInterests || null,
        },
      },
      alumniProfile: {
        create: {
          companyId: companyId || null,
          designation: designation || null,
          experienceYears: experienceYears !== undefined ? experienceYears : null,
          verificationStatus: 'PENDING',
        },
      },
      userSettings: {
        create: {},
      },
    },
    include: {
      academicProfile: { include: { department: true } },
      alumniProfile: { include: { company: true } },
      userSettings: true,
    },
  });
}

// ─── Company upsert ───────────────────────────────────────────────────────────

/**
 * Upsert a company by name_key = lower(trim(name)).
 * Per PDF §3.2: backend sets name_key to normalise spelling variants.
 *
 * @param {string} name  Raw company name from the request
 * @returns {Promise<{id: string, name: string, nameKey: string}>}
 */
async function upsertCompany(name) {
  const nameKey = name.trim().toLowerCase();
  return prisma.company.upsert({
    where: { nameKey },
    update: {},       // Do not overwrite the existing canonical name
    create: { name: name.trim(), nameKey },
  });
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

/**
 * Store a hashed refresh token.
 *
 * @param {{userId, tokenHash, expiresAt}} data
 */
async function createRefreshToken({ userId, tokenHash, expiresAt }) {
  return prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

/**
 * Find a valid (not revoked, not expired) refresh token by its hash.
 */
async function findRefreshToken(tokenHash) {
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

/**
 * Revoke a specific refresh token by its ID.
 */
async function revokeRefreshToken(id) {
  return prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke ALL refresh tokens for a user (logout all devices).
 */
async function revokeAllUserRefreshTokens(userId) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Update a user's hashed password.
 */
async function updateUserPassword(userId, passwordHash) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

module.exports = {
  findUserByEmail,
  findUserById,
  resolveDepartmentId,
  createStudent,
  createAlumni,
  upsertCompany,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  updateUserPassword,
};

