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
const graph = require('../../../services/graphService');

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
 * Throws unless the user may sign in as far as alumni verification goes.
 * Students and admins are unaffected.
 */
function assertAlumniApproved(user) {
  if (user.role !== 'ALUMNI') return;
  const verification = user.alumniProfile?.verificationStatus;
  if (verification === 'APPROVED') return;

  if (verification === 'REJECTED') {
    throw new AppError(
      'Your alumni verification was not approved. You can register again with updated details.',
      403,
      'ALUMNI_REJECTED',
    );
  }
  throw new AppError(
    'Your alumni account is awaiting admin approval. You will be able to log in once it is approved.',
    403,
    'ALUMNI_PENDING_APPROVAL',
  );
}

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

  // 1. Duplicate email check. The one exception: an alumnus whose application
  //    was REJECTED may register again with the same email (and starts a fresh
  //    application). A pending application is reported as such rather than as a
  //    generic duplicate, so the person knows to wait.
  const existing = await authRepo.findUserByEmail(email);
  let reapplyUserId = null;
  if (existing) {
    const verification = existing.role === 'ALUMNI' ? existing.alumniProfile?.verificationStatus : null;

    if (role === 'ALUMNI' && verification === 'REJECTED' && existing.status === 'ACTIVE') {
      reapplyUserId = existing.id;
    } else if (existing.role === 'ALUMNI' && verification !== 'APPROVED' && verification !== 'REJECTED' && existing.status === 'ACTIVE') {
      throw new AppError(
        'An application for this email is already awaiting admin approval. You will be able to log in once it is approved.',
        409,
        'ALUMNI_PENDING_APPROVAL',
      );
    } else {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_TAKEN');
    }
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
  if (role === 'ALUMNI' && reapplyUserId) {
    newUser = await authRepo.reapplyAlumni(reapplyUserId, {
      name,
      passwordHash,
      departmentId: resolvedDepartmentId,
      graduationYear,
      bio,
      careerInterests,
      companyId,
      designation,
      experienceYears,
    });
  } else if (role === 'ALUMNI') {
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

  // Alumni are not signed in: their account stays unusable until an admin
  // approves it. They are also not added to the graph yet, so an unapproved
  // alumnus can never show up in connection suggestions; the admin approval
  // step syncs them.
  if (role === 'ALUMNI') {
    return { user: sanitiseUser(newUser), accessToken: null, rawRefreshToken: null, pendingApproval: true };
  }

  // Mirror the new user into the graph straight away. Without this the node
  // only appears at the next `npm run graph:sync`, and until then the person
  // is invisible to every graph feature. Best-effort by design: the graph is
  // derived data, so registration must not fail when Neo4j is unavailable.
  await graph.syncUserToGraph(newUser);

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

  // 4. Alumni may only sign in once an admin has approved them. This runs after
  //    the password check, so the status is only ever revealed to the account's
  //    owner and never to someone guessing emails.
  assertAlumniApproved(user);

  // 5. Issue tokens
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

  // A session must not outlive an alumnus's approval: if they were rejected (or
  // sent back to pending) after signing in, stop renewing it.
  if (user.role === 'ALUMNI') {
    const fullUser = await authRepo.findUserById(user.id);
    try {
      assertAlumniApproved(fullUser);
    } catch (err) {
      await authRepo.revokeRefreshToken(record.id);
      throw err;
    }
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
  return sanitiseUser(user);
}

/**

 * Change user password after verifying the current password.
 *
 * @param {string} userId
 * @param {{ currentPassword: string, newPassword: string }} data
 */
async function changePassword(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400, 'VALIDATION_ERROR');
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400, 'VALIDATION_ERROR');
  }

  const user = await authRepo.findUserById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_CREDENTIALS');
  }

  const newHash = await hashPassword(newPassword);
  await authRepo.updateUserPassword(userId, newHash);

  return { message: 'Password updated successfully' };
}

/**
 * Reset password using email and department verification.
 * Verifies that the user exists, is active, and their registered academic department matches.
 *
 * @param {{ email: string, departmentId: string, newPassword: string }} data
 */
async function resetPasswordWithDepartment({ email, departmentId, newPassword }) {
  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw new AppError('The provided email and department do not match our records.', 400, 'INVALID_VERIFICATION');
  }

  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw new AppError('This account is not eligible for password reset. Please contact support.', 403, 'ACCOUNT_INACTIVE');
  }

  // Resolve department
  const resolvedDeptId = await authRepo.resolveDepartmentId(departmentId);
  const userDeptId = user.academicProfile?.departmentId;
  const userDeptCode = user.academicProfile?.department?.code?.toUpperCase();
  const inputDeptClean = departmentId?.toUpperCase().trim();

  const isMatch =
    (resolvedDeptId && userDeptId && resolvedDeptId === userDeptId) ||
    (userDeptCode && (userDeptCode === inputDeptClean || userDeptCode === resolvedDeptId));

  if (!isMatch) {
    throw new AppError('The provided email and department do not match our records.', 400, 'INVALID_VERIFICATION');
  }

  // Hash new password and update
  const newHash = await hashPassword(newPassword);
  await authRepo.updateUserPassword(user.id, newHash);

  // Invalidate all active sessions across devices
  await authRepo.revokeAllUserRefreshTokens(user.id);

  return { message: 'Password has been reset successfully. You can now log in with your new password.' };
}

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  logoutAll,
  getMe,
  changePassword,
  resetPasswordWithDepartment,
  verifyAccessToken,
};


