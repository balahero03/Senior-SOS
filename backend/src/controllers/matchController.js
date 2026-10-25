// backend/src/controllers/matchController.js
// "Best fit" alumni recommendations for students.

'use strict';

const matchService = require('../services/matchService');
const peerMatchService = require('../services/peerMatchService');
const matchCache = require('../services/matchCache');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');

/**
 * GET /api/match/alumni
 * Query: limit, companyId, departmentId, skillId, interest
 *
 * Ranks verified alumni against the signed-in student's skills, interests,
 * department and network, and returns the reasons behind each score.
 */
const getAlumniMatches = asyncHandler(async (req, res) => {
  const userId = req.user.sub || req.user.id;
  const role = req.user.role;

  // Alumni and admins have their own tools; this one answers a student's
  // question, and the scoring assumes a student profile on one side.
  if (role !== 'STUDENT') {
    throw new AppError(
      'Alumni recommendations are for student accounts',
      403,
      'STUDENTS_ONLY',
    );
  }

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const { companyId, departmentId, skillId, interest } = req.query;

  const filters = {
    limit,
    companyId: companyId || undefined,
    departmentId: departmentId || undefined,
    skillId: skillId || undefined,
    interest: interest?.trim() || undefined,
  };
  const { value: result, source } = await matchCache.withMatchCache(
    userId, 'alumni', filters, () => matchService.recommendAlumni(userId, filters),
  );

  res.set('X-Cache', source);
  res.json({ success: true, data: result });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads an optional UUID query param; a malformed id is a 400, not a database error. */
function optionalUuid(value, name) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new AppError(`${name} must be a valid id`, 400, 'VALIDATION_ERROR');
  }
  return value;
}

/**
 * GET /api/match/peers
 * Query: limit, role (ALL | ALUMNI | STUDENT), skillId, departmentId, companyId, interest
 *
 * "People like you": students are matched with other students; alumni are
 * matched with alumni and/or students. Students cannot widen the role filter,
 * and admins are not served.
 */
const getPeerMatches = asyncHandler(async (req, res) => {
  const userId = req.user.sub || req.user.id;
  const viewerRole = req.user.role;

  if (viewerRole !== 'STUDENT' && viewerRole !== 'ALUMNI') {
    throw new AppError(
      'Peer recommendations are for student and alumni accounts',
      403,
      'PEERS_NOT_AVAILABLE',
    );
  }

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const role = String(req.query.role || 'ALL').toUpperCase();
  if (!['ALL', 'ALUMNI', 'STUDENT'].includes(role)) {
    throw new AppError('role must be ALL, ALUMNI or STUDENT', 400, 'VALIDATION_ERROR');
  }

  const interest = typeof req.query.interest === 'string'
    ? req.query.interest.trim().slice(0, 200)
    : '';

  const filters = {
    limit,
    role,
    skillId: optionalUuid(req.query.skillId, 'skillId'),
    departmentId: optionalUuid(req.query.departmentId, 'departmentId'),
    companyId: optionalUuid(req.query.companyId, 'companyId'),
    interest: interest || undefined,
  };
  const { value: result, source } = await matchCache.withMatchCache(
    userId, 'peers', filters, () => peerMatchService.recommendPeers(userId, viewerRole, filters),
  );

  res.set('X-Cache', source);
  res.json({ success: true, data: result });
});

module.exports = { getAlumniMatches, getPeerMatches };
