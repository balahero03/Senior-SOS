// backend/src/controllers/mentorshipController.js
// Mentorship workflow controller for SeniorSOS.
// Enforces lifecycle transitions, roles, and open mentorship pair constraints.

'use strict';

const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');
const { createNotification } = require('../services/notificationService');

// Allowed mentorship frequencies
const VALID_FREQUENCIES = ['ONE_TIME', 'WEEKLY', 'MONTHLY'];

/**
 * POST /api/mentorship/request
 * Send a mentorship request from Mentee (student) to Mentor (alumnus).
 */
const requestMentorship = asyncHandler(async (req, res) => {
  const menteeId = req.user.id || req.user.sub;
  const { mentorId, focusArea, helpDescription, goals, frequency } = req.body;

  if (!mentorId) {
    throw new AppError('mentorId is required', 400, 'VALIDATION_ERROR');
  }

  if (menteeId === mentorId) {
    throw new AppError('You cannot request mentorship from yourself', 400, 'SELF_MENTORSHIP_FORBIDDEN');
  }

  if (!focusArea || !focusArea.trim()) {
    throw new AppError('focusArea is required', 400, 'VALIDATION_ERROR');
  }

  const selectedFrequency = frequency || 'ONE_TIME';
  if (!VALID_FREQUENCIES.includes(selectedFrequency)) {
    throw new AppError(`frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  // Validate mentor: must exist, be ACTIVE, and have role ALUMNI
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
      alumniProfile: { select: { verificationStatus: true } },
    },
  });

  if (!mentor) {
    throw new AppError('Mentor not found', 404, 'MENTOR_NOT_FOUND');
  }

  if (mentor.status !== 'ACTIVE') {
    throw new AppError('Mentor account is not active', 400, 'USER_INACTIVE');
  }

  if (mentor.role !== 'ALUMNI') {
    throw new AppError('Mentorship can only be requested from an alumnus', 400, 'INVALID_MENTOR_ROLE');
  }

  // Enforce single open mentorship constraint (PENDING or ACTIVE between this pair)
  const existingOpen = await prisma.mentorshipRequest.findFirst({
    where: {
      menteeId,
      mentorId,
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  });

  if (existingOpen) {
    throw new AppError(
      `An open mentorship already exists with this mentor (Status: ${existingOpen.status})`,
      400,
      'OPEN_MENTORSHIP_EXISTS'
    );
  }

  const request = await prisma.mentorshipRequest.create({
    data: {
      menteeId,
      mentorId,
      focusArea: focusArea.trim(),
      helpDescription: helpDescription ? helpDescription.trim() : null,
      goals: goals ? goals.trim() : null,
      frequency: selectedFrequency,
      status: 'PENDING',
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          role: true,
          alumniProfile: {
            select: {
              designation: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Notify mentor of new incoming mentorship request
  await createNotification({
    recipientId: mentorId,
    actorId: menteeId,
    type: 'MENTORSHIP_REQUEST_RECEIVED',
    payload: {
      mentorshipId: request.id,
      focusArea: request.focusArea,
      frequency: request.frequency,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      mentorship: request,
      message: 'Mentorship request sent successfully',
    },
  });
});

/**
 * GET /api/mentorship/my-mentorships
 * Returns active and pending mentorships where user is either mentee or mentor.
 */
const getMyMentorships = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;

  const mentorships = await prisma.mentorshipRequest.findMany({
    where: {
      OR: [{ menteeId: currentUserId }, { mentorId: currentUserId }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
          role: true,
          academicProfile: {
            select: {
              graduationYear: true,
              department: { select: { code: true, name: true } },
            },
          },
        },
      },
      mentor: {
        select: {
          id: true,
          name: true,
          role: true,
          academicProfile: {
            select: {
              graduationYear: true,
              department: { select: { code: true, name: true } },
            },
          },
          alumniProfile: {
            select: {
              designation: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Format response and attach partner profile
  const formatted = mentorships.map((m) => {
    const isMentee = m.menteeId === currentUserId;
    const partner = isMentee ? m.mentor : m.mentee;

    return {
      id: m.id,
      role: isMentee ? 'MENTEE' : 'MENTOR',
      status: m.status,
      focusArea: m.focusArea,
      helpDescription: m.helpDescription,
      goals: m.goals,
      frequency: m.frequency,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      partner: {
        id: partner.id,
        name: partner.name,
        role: partner.role,
        department: partner.academicProfile?.department?.code || null,
        graduationYear: partner.academicProfile?.graduationYear || null,
        company: partner.alumniProfile?.company?.name || null,
        designation: partner.alumniProfile?.designation || null,
      },
    };
  });

  res.json({
    success: true,
    data: {
      mentorships: formatted,
    },
  });
});

/**
 * PATCH /api/mentorship/:id/status
 * Update mentorship lifecycle status with transition & timestamp rules:
 * - PENDING -> ACTIVE: Mentor only (sets started_at = new Date())
 * - PENDING -> REJECTED: Mentor only
 * - PENDING -> CANCELLED: Mentee only
 * - ACTIVE -> ENDED: Either party (sets ended_at = new Date())
 */
const updateMentorshipStatus = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new AppError('status is required', 400, 'VALIDATION_ERROR');
  }

  const mentorship = await prisma.mentorshipRequest.findUnique({
    where: { id },
  });

  if (!mentorship) {
    throw new AppError('Mentorship request not found', 404, 'NOT_FOUND');
  }

  const isMentor = mentorship.mentorId === currentUserId;
  const isMentee = mentorship.menteeId === currentUserId;

  if (!isMentor && !isMentee && req.user.role !== 'ADMIN') {
    throw new AppError('You are not authorized to update this mentorship', 403, 'FORBIDDEN');
  }

  const currentStatus = mentorship.status;
  const updateData = { status };

  if (currentStatus === 'PENDING') {
    if (status === 'ACTIVE') {
      if (!isMentor && req.user.role !== 'ADMIN') {
        throw new AppError('Only the mentor can accept a mentorship request', 403, 'FORBIDDEN');
      }
      updateData.startedAt = new Date();
    } else if (status === 'REJECTED') {
      if (!isMentor && req.user.role !== 'ADMIN') {
        throw new AppError('Only the mentor can reject a mentorship request', 403, 'FORBIDDEN');
      }
    } else if (status === 'CANCELLED') {
      if (!isMentee && req.user.role !== 'ADMIN') {
        throw new AppError('Only the mentee can cancel their mentorship request', 403, 'FORBIDDEN');
      }
    } else {
      throw new AppError(
        `Invalid status transition from PENDING to ${status}. Allowed: ACTIVE, REJECTED, CANCELLED`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }
  } else if (currentStatus === 'ACTIVE') {
    if (status === 'ENDED') {
      updateData.endedAt = new Date();
    } else {
      throw new AppError(
        `Invalid status transition from ACTIVE to ${status}. Allowed: ENDED`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }
  } else {
    throw new AppError(
      `Cannot change status of mentorship that is already ${currentStatus}`,
      400,
      'MENTORSHIP_ALREADY_CLOSED'
    );
  }

  const updated = await prisma.mentorshipRequest.update({
    where: { id },
    data: updateData,
  });

  // Notify the other party about the status update
  const partnerId = isMentor ? mentorship.menteeId : mentorship.mentorId;
  await createNotification({
    recipientId: partnerId,
    actorId: currentUserId,
    type: 'MENTORSHIP_STATUS_UPDATED',
    payload: {
      mentorshipId: id,
      oldStatus,
      newStatus: status,
    },
  });

  res.json({
    success: true,
    data: {
      mentorship: updated,
      message: `Mentorship status updated to ${status}`,
    },
  });
});

module.exports = {
  requestMentorship,
  getMyMentorships,
  updateMentorshipStatus,
};
