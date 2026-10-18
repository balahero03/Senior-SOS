// backend/src/controllers/matchController.js
// "Best fit" alumni recommendations for students.

'use strict';

const matchService = require('../services/matchService');
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

  const result = await matchService.recommendAlumni(userId, {
    limit,
    companyId: companyId || undefined,
    departmentId: departmentId || undefined,
    skillId: skillId || undefined,
    interest: interest?.trim() || undefined,
  });

  res.json({ success: true, data: result });
});

module.exports = { getAlumniMatches };
