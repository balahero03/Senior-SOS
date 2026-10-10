// backend/src/controllers/referralController.js
// Referral workflow controller for SeniorSOS.
// Enforces role checks, company upsert, open referral uniqueness,
// and single-transaction status updates with audit history.

'use strict';

const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');

// Allowed referral statuses
const VALID_REFERRAL_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'REFERRED',
  'INTERVIEW',
  'COMPLETED',
  'CANCELLED',
];

// Open statuses that prevent duplicates
const OPEN_STATUSES = ['PENDING', 'ACCEPTED', 'REFERRED', 'INTERVIEW'];

/**
 * POST /api/referrals/request
 * Student requests a job referral from an approved Alumnus.
 */
const requestReferral = asyncHandler(async (req, res) => {
  const studentId = req.user.id || req.user.sub;
  const { alumniId, companyId, companyName, jobTitle, jobUrl, reason, message, resumeUrl } = req.body;

  if (!alumniId) {
    throw new AppError('alumniId is required', 400, 'VALIDATION_ERROR');
  }

  if (!jobTitle || !jobTitle.trim()) {
    throw new AppError('jobTitle is required', 400, 'VALIDATION_ERROR');
  }

  if (studentId === alumniId) {
    throw new AppError('You cannot request a referral from yourself', 400, 'SELF_REFERRAL_FORBIDDEN');
  }

  // 1. Verify student role
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, status: true },
  });

  if (!student || student.status !== 'ACTIVE' || student.role !== 'STUDENT') {
    throw new AppError('Only active students can request job referrals', 403, 'FORBIDDEN_STUDENT_ONLY');
  }

  // 2. Verify alumnus role & approval
  const alumnus = await prisma.user.findUnique({
    where: { id: alumniId },
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
      alumniProfile: {
        select: {
          verificationStatus: true,
          companyId: true,
        },
      },
    },
  });

  if (!alumnus) {
    throw new AppError('Alumnus not found', 404, 'ALUMNUS_NOT_FOUND');
  }

  if (alumnus.status !== 'ACTIVE' || alumnus.role !== 'ALUMNI') {
    throw new AppError('Referrals can only be requested from active alumni', 400, 'INVALID_ALUMNI');
  }

  if (alumnus.alumniProfile?.verificationStatus !== 'APPROVED') {
    throw new AppError('Referrals can only be requested from verified alumni', 400, 'ALUMNI_NOT_VERIFIED');
  }

  // 3. Resolve Company: use companyId if provided, or find/upsert by companyName
  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId) {
    if (companyName && companyName.trim()) {
      const trimmedName = companyName.trim();
      const nameKey = trimmedName.toLowerCase();
      const company = await prisma.company.upsert({
        where: { nameKey },
        update: {},
        create: { name: trimmedName, nameKey },
      });
      resolvedCompanyId = company.id;
    } else if (alumnus.alumniProfile?.companyId) {
      resolvedCompanyId = alumnus.alumniProfile.companyId;
    } else {
      throw new AppError('Company is required for a referral request', 400, 'VALIDATION_ERROR');
    }
  } else {
    const existingCompany = await prisma.company.findUnique({
      where: { id: resolvedCompanyId },
    });
    if (!existingCompany) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }
  }

  // 4. Check for duplicate open referral (same student, alumnus, company, and LOWER(job_title))
  const cleanJobTitle = jobTitle.trim();
  const lowerJobTitle = cleanJobTitle.toLowerCase();

  const existingReferrals = await prisma.referralRequest.findMany({
    where: {
      studentId,
      alumniId,
      companyId: resolvedCompanyId,
      status: { in: OPEN_STATUSES },
    },
    select: { id: true, jobTitle: true, status: true },
  });

  const duplicate = existingReferrals.find(
    (r) => r.jobTitle.trim().toLowerCase() === lowerJobTitle
  );

  if (duplicate) {
    throw new AppError(
      `An open referral for "${cleanJobTitle}" already exists with this alumnus (Status: ${duplicate.status})`,
      400,
      'OPEN_REFERRAL_EXISTS'
    );
  }

  // 5. Create referral request and initial history inside a transaction
  const referral = await prisma.$transaction(async (tx) => {
    const created = await tx.referralRequest.create({
      data: {
        studentId,
        alumniId,
        companyId: resolvedCompanyId,
        jobTitle: cleanJobTitle,
        jobUrl: jobUrl ? jobUrl.trim() : null,
        reason: reason ? reason.trim() : null,
        message: message ? message.trim() : null,
        resumeUrl: resumeUrl ? resumeUrl.trim() : null,
        status: 'PENDING',
      },
      include: {
        company: { select: { id: true, name: true } },
        alumni: { select: { id: true, name: true, role: true } },
      },
    });

    await tx.referralStatusHistory.create({
      data: {
        referralId: created.id,
        oldStatus: null,
        newStatus: 'PENDING',
        changedBy: studentId,
        note: 'Referral request submitted',
      },
    });

    return created;
  });

  res.status(201).json({
    success: true,
    data: {
      referral,
      message: 'Referral request submitted successfully',
    },
  });
});

/**
 * GET /api/referrals/received
 * Alumnus views referrals directed to them.
 */
const getReceivedReferrals = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;

  const referrals = await prisma.referralRequest.findMany({
    where: { alumniId: currentUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { id: true, name: true } },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          academicProfile: {
            select: {
              graduationYear: true,
              department: { select: { code: true, name: true } },
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        include: {
          changedByUser: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  res.json({
    success: true,
    data: { referrals },
  });
});

/**
 * GET /api/referrals/sent
 * Student views referrals they created.
 */
const getSentReferrals = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;

  const referrals = await prisma.referralRequest.findMany({
    where: { studentId: currentUserId },
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { id: true, name: true } },
      alumni: {
        select: {
          id: true,
          name: true,
          alumniProfile: {
            select: {
              designation: true,
              company: { select: { name: true } },
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        include: {
          changedByUser: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  res.json({
    success: true,
    data: { referrals },
  });
});

/**
 * PATCH /api/referrals/:id/status
 * Update referral status with atomic history logging inside a transaction.
 */
const updateReferralStatus = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const { id } = req.params;
  const { status, note } = req.body;

  if (!status || !VALID_REFERRAL_STATUSES.includes(status)) {
    throw new AppError(
      `Invalid status. Allowed values: ${VALID_REFERRAL_STATUSES.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const referral = await prisma.referralRequest.findUnique({
    where: { id },
  });

  if (!referral) {
    throw new AppError('Referral request not found', 404, 'NOT_FOUND');
  }

  const isStudent = referral.studentId === currentUserId;
  const isAlumni = referral.alumniId === currentUserId;

  if (!isStudent && !isAlumni && req.user.role !== 'ADMIN') {
    throw new AppError('You are not authorized to update this referral', 403, 'FORBIDDEN');
  }

  // Student can only CANCEL a pending referral
  if (isStudent && !isAlumni && req.user.role !== 'ADMIN') {
    if (status !== 'CANCELLED') {
      throw new AppError('Students can only cancel their referral requests', 403, 'FORBIDDEN');
    }
  }

  const oldStatus = referral.status;

  if (oldStatus === status) {
    throw new AppError(`Referral is already in status ${status}`, 400, 'NO_STATUS_CHANGE');
  }

  // Execute in an interactive transaction
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.referralRequest.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    const history = await tx.referralStatusHistory.create({
      data: {
        referralId: id,
        oldStatus,
        newStatus: status,
        changedBy: currentUserId,
        note: note ? note.trim() : null,
      },
    });

    return { updated, history };
  });

  res.json({
    success: true,
    data: {
      referral: result.updated,
      history: result.history,
      message: `Referral status updated to ${status}`,
    },
  });
});

module.exports = {
  requestReferral,
  getReceivedReferrals,
  getSentReferrals,
  updateReferralStatus,
};
