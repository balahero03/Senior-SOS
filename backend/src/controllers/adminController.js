// backend/src/controllers/adminController.js
// Admin controller for SeniorSOS.
// Handles aggregate analytics, alumni verifications with audit logs,
// user status management, and audit log inspection.

'use strict';

const { prisma } = require('../database/postgres');
const { Post } = require('../models');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');
const { createNotification } = require('../services/notificationService');

/**
 * GET /api/admin/stats
 * Aggregate metrics across PostgreSQL and MongoDB:
 * - totalUsers, studentsCount, alumniCount, pendingVerifications (PostgreSQL)
 * - activePosts (MongoDB)
 */
const getAdminStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    studentsCount,
    alumniCount,
    pendingVerifications,
    verifiedAlumniCount,
    activeConnectionsCount,
    totalDepartmentsCount,
    totalCompaniesCount,
    departmentsWithCounts,
  ] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: 'ALUMNI', status: 'ACTIVE' } }),
    prisma.alumniProfile.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.alumniProfile.count({ where: { verificationStatus: 'APPROVED' } }),
    prisma.connection.count(),
    prisma.department.count(),
    prisma.company.count(),
    prisma.department.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        _count: {
          select: { academicProfiles: true },
        },
      },
      orderBy: { code: 'asc' },
    }),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        studentsCount,
        alumniCount,
        pendingVerifications,
        verifiedAlumniCount,
        activeConnectionsCount,
        totalDepartmentsCount,
        totalCompaniesCount,
        departmentsBreakdown: departmentsWithCounts.map((d) => ({
          code: d.code,
          name: d.name,
          enrolledCount: d._count.academicProfiles,
        })),
      },
    },
  });
});

/**
 * GET /api/admin/verifications
 * Returns alumni profiles where verification_status === 'PENDING',
 * hydrated with user personal, academic, and company details.
 */
const getPendingVerifications = asyncHandler(async (req, res) => {
  const pendingProfiles = await prisma.alumniProfile.findMany({
    where: { verificationStatus: 'PENDING' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          academicProfile: {
            select: {
              graduationYear: true,
              department: { select: { code: true, name: true } },
            },
          },
        },
      },
      company: {
        select: { id: true, name: true },
      },
    },
    orderBy: { user: { createdAt: 'desc' } },
  });

  const formatted = pendingProfiles.map((p) => ({
    userId: p.userId,
    name: p.user.name,
    email: p.user.email,
    role: p.user.role,
    userStatus: p.user.status,
    department: p.user.academicProfile?.department?.code || null,
    departmentName: p.user.academicProfile?.department?.name || null,
    graduationYear: p.user.academicProfile?.graduationYear || null,
    company: p.company?.name || null,
    companyId: p.companyId,
    designation: p.designation,
    experienceYears: p.experienceYears ? Number(p.experienceYears) : null,
    verificationStatus: p.verificationStatus,
  }));

  res.json({
    success: true,
    data: {
      verifications: formatted,
    },
  });
});

/**
 * PATCH /api/admin/verifications/:id
 * Body: { status: 'APPROVED' | 'REJECTED' }
 * Updates alumni verification status and logs to audit_logs inside a single Prisma transaction.
 * :id is the userId of the alumnus.
 */
const updateVerificationStatus = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const { id: targetUserId } = req.params;
  const { status } = req.body;

  if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
    throw new AppError("status must be either 'APPROVED' or 'REJECTED'", 400, 'VALIDATION_ERROR');
  }

  const alumniProfile = await prisma.alumniProfile.findUnique({
    where: { userId: targetUserId },
  });

  if (!alumniProfile) {
    throw new AppError('Alumni profile not found for this user', 404, 'NOT_FOUND');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedProfile = await tx.alumniProfile.update({
      where: { userId: targetUserId },
      data: {
        verificationStatus: status,
        verifiedAt: status === 'APPROVED' ? new Date() : null,
      },
      include: {
        company: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const auditLog = await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ALUMNI_VERIFICATION',
        targetType: 'ALUMNI_PROFILE',
        targetId: targetUserId,
        metadata: {
          previousStatus: alumniProfile.verificationStatus,
          newStatus: status,
        },
      },
    });

    return { updatedProfile, auditLog };
  });

  // Dispatch in-app notification to the reviewed alumnus
  await createNotification({
    recipientId: targetUserId,
    actorId: adminId,
    type: status === 'APPROVED' ? 'ALUMNI_VERIFIED' : 'ALUMNI_REJECTED',
    payload: {
      status,
      message:
        status === 'APPROVED'
          ? 'Congratulations! Your alumni credentials have been verified by the administrator. Welcome to the verified mentor network!'
          : 'Your alumni verification request was declined. Please verify your graduation and employer details.',
      reviewedAt: new Date().toISOString(),
    },
  });

  res.json({
    success: true,
    data: {
      profile: result.updatedProfile,
      auditLogId: result.auditLog.id,
      message: `Alumni verification status updated to ${status}`,
    },
  });
});

/**
 * PATCH /api/admin/users/:id/status
 * Body: { status: 'ACTIVE' | 'SUSPENDED' }
 * Updates user account status and logs to audit_logs inside a single Prisma transaction.
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const adminId = req.user.id || req.user.sub;
  const { id: targetUserId } = req.params;
  const { status } = req.body;

  if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
    throw new AppError("status must be either 'ACTIVE' or 'SUSPENDED'", 400, 'VALIDATION_ERROR');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (targetUser.id === adminId) {
    throw new AppError('You cannot modify your own status', 400, 'SELF_STATUS_MODIFICATION');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: targetUserId },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    const auditLog = await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_STATUS_CHANGE',
        targetType: 'USER',
        targetId: targetUserId,
        metadata: {
          previousStatus: targetUser.status,
          newStatus: status,
        },
      },
    });

    return { updatedUser, auditLog };
  });

  res.json({
    success: true,
    data: {
      user: result.updatedUser,
      auditLogId: result.auditLog.id,
      message: `User status updated to ${status}`,
    },
  });
});

/**
 * GET /api/admin/audit-logs
 * Returns paginated audit logs with actor hydration.
 */
const getAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

module.exports = {
  getAdminStats,
  getPendingVerifications,
  updateVerificationStatus,
  updateUserStatus,
  getAuditLogs,
};
