// backend/src/modules/auth/services/auth.service.js
// Business rules for the auth module.
// Calls the repository for data access; no HTTP concepts here.
// Per FOLDER_STRUCTURE.md: business rules live in services, not controllers.

'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../config');
const AppError = require('../../../shared/errors/AppError');
const authRepo = require('../repositories/auth.repository');

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12; // Cost factor — calibrated for ~100–200 ms on average hardware

// ─── Password helpers ─────────────────────────────────────────────────────────

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Sign a short-lived access token.
 * Payload: { sub: userId, role }
 */
function signAccessToken(userId, role) {
  return jwt.sign({ sub: userId, role }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Generate a cryptographically secure refresh token (opaque string).
 * The raw token is sent to the client; only the SHA-256 hash is stored in DB.
 */
function generateRefreshToken() {
  const raw = crypto.randomBytes(32).toString('hex'); // 64-char hex string
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

/**
 * Verify an access token. Returns the decoded payload or throws AppError.
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new AppError('Invalid or expired access token', 401, 'TOKEN_INVALID');
  }
}

// ─── Strip sensitive fields before returning user to caller ───────────────────

function sanitiseUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ─── Auth service operations ──────────────────────────────────────────────────

/**
 * Register a new STUDENT or ALUMNI.
 *
 * Per PDF §3.2:
 *  - ALUMNI must create alumni_profiles in the same transaction (handled in repository).
 *  - Company is upserted by name_key before the user transaction.
 *  - user_settings is created in the same transaction.
 *
 * @returns {{ user, accessToken, rawRefreshToken }}
 */
async function register(data) {
  const {
    name,
    email,
    password,
    role,
    departmentId,
    graduationYear,
    bio,
    careerInterests,
    company,
    designation,
    experienceYears,
  } = data;

  // 1. Duplicate email check
  const existing = await authRepo.findUserByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists', 409, 'EMAIL_TAKEN');
  }

  // 2. Hash password (bcrypt, cost=12)
  const passwordHash = await hashPassword(password);

  // 3. Resolve department ID (by UUID, code, or name)
  const resolvedDepartmentId = await authRepo.resolveDepartmentId(departmentId);

  // 4. Upsert company for alumni (name_key = lower(trim(name)))
  let companyId = null;
  if (role === 'ALUMNI' && company) {
    const companyRecord = await authRepo.upsertCompany(company);
    companyId = companyRecord.id;
  }

  // 5. Create user (one Prisma transaction per repository layer)
  let newUser;
  if (role === 'ALUMNI') {
    newUser = await authRepo.createAlumni({
      name,
      email,
      passwordHash,
      departmentId: resolvedDepartmentId,
      graduationYear,
      bio,
      careerInterests,
      companyId,
      designation,
      experienceYears,
    });
  } else {
    newUser = await authRepo.createStudent({
      name,
      email,
      passwordHash,
      departmentId: resolvedDepartmentId,
      graduationYear,
      bio,
      careerInterests,
    });
  }

  // 5. Issue tokens
  const accessToken = signAccessToken(newUser.id, newUser.role);
  const { raw: rawRefreshToken, hash: tokenHash } = generateRefreshToken();

  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlMs);
  await authRepo.createRefreshToken({ userId: newUser.id, tokenHash, expiresAt });

  return { user: sanitiseUser(newUser), accessToken, rawRefreshToken };
}

/**
 * Login with email + password.
 * Returns tokens on success; throws AppError on failure.
 * Uses a single vague error message for bad credentials (no user enumeration).
 *
 * @returns {{ user, accessToken, rawRefreshToken }}
 */
async function login({ email, password }) {
  // 1. Find user — use the same message whether the email or password is wrong
  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // 2. Check account status before comparing the password
  if (user.status === 'SUSPENDED') {
    throw new AppError('This account has been suspended', 403, 'ACCOUNT_SUSPENDED');
  }
  if (user.status === 'DEACTIVATED') {
    throw new AppError('This account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  // 3. Compare password (timing-safe via bcrypt)
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // 4. Issue tokens
  const accessToken = signAccessToken(user.id, user.role);
  const { raw: rawRefreshToken, hash: tokenHash } = generateRefreshToken();

  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlMs);
  await authRepo.createRefreshToken({ userId: user.id, tokenHash, expiresAt });

  return { user: sanitiseUser(user), accessToken, rawRefreshToken };
}

/**
 * Refresh access token using a valid refresh token.
 * Implements token rotation: the old token is revoked and a new one is issued.
 *
 * @param {string} rawRefreshToken  The opaque token value from the cookie
 * @returns {{ user, accessToken, rawRefreshToken }}
 */
async function refreshTokens(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new AppError('No refresh token provided', 401, 'TOKEN_MISSING');
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const record = await authRepo.findRefreshToken(tokenHash);

  if (!record) {
    throw new AppError('Refresh token is invalid or expired', 401, 'TOKEN_INVALID');
  }

  const user = record.user;
  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
  }

  // Rotate: revoke old token
  await authRepo.revokeRefreshToken(record.id);

  // Issue new tokens
  const accessToken = signAccessToken(user.id, user.role);
  const { raw: newRawToken, hash: newHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlMs);
  await authRepo.createRefreshToken({ userId: user.id, tokenHash: newHash, expiresAt });

  return { user: sanitiseUser(user), accessToken, rawRefreshToken: newRawToken };
}

/**
 * Logout: revoke the specific refresh token so it cannot be reused.
 *
 * @param {string} rawRefreshToken
 */
async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return; // Already not logged in — no-op

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const record = await authRepo.findRefreshToken(tokenHash);
  if (record) {
    await authRepo.revokeRefreshToken(record.id);
  }
}

/**
 * Logout all devices: revoke every active refresh token for the user.
 *
 * @param {string} userId
 */
async function logoutAll(userId) {
  await authRepo.revokeAllUserRefreshTokens(userId);
}

/**
 * Return the current user (for GET /me).
 * Uses findUserById which includes profiles and skills.
 *
 * @param {string} userId
 */
async function getMe(userId) {
  const user = await authRepo.findUserById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  return sanitiseUser(user);
}

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  logoutAll,
  getMe,
  verifyAccessToken,
};
