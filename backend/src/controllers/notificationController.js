// backend/src/controllers/notificationController.js
// Notifications controller for SeniorSOS.
// Handles fetching notifications with pagination & filters, and marking them read.

'use strict';

const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');

/**
 * GET /api/notifications
 * Fetches notifications for current user with optional ?unreadOnly=true and pagination.
 * Returns hydrated actor details and total unread count.
 */
const getNotifications = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const unreadOnly = req.query.unreadOnly === 'true';

  const where = {
    recipientId: currentUserId,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [total, unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        recipientId: currentUserId,
        readAt: null,
      },
    }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
            academicProfile: {
              select: {
                department: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  // Format actor info
  const formattedNotifications = notifications.map((n) => {
    let formattedActor = null;
    if (n.actor) {
      formattedActor = {
        id: n.actor.id,
        name: n.actor.name,
        role: n.actor.role,
        department: n.actor.academicProfile?.department?.code || null,
        departmentName: n.actor.academicProfile?.department?.name || null,
      };
    }

    return {
      id: n.id,
      recipientId: n.recipientId,
      actorId: n.actorId,
      actor: formattedActor,
      type: n.type,
      payload: n.payload,
      readAt: n.readAt,
      createdAt: n.createdAt,
    };
  });

  res.json({
    success: true,
    data: {
      notifications: formattedNotifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
const markAsRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }

  if (notification.recipientId !== currentUserId) {
    throw new AppError('You are not authorized to update this notification', 403, 'FORBIDDEN');
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: {
      readAt: notification.readAt || new Date(),
    },
  });

  res.json({
    success: true,
    data: {
      notification: updated,
      message: 'Notification marked as read',
    },
  });
});

/**
 * PATCH /api/notifications/read-all
 * Marks all unread notifications for current user as read.
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id || req.user.sub;

  const result = await prisma.notification.updateMany({
    where: {
      recipientId: currentUserId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  res.json({
    success: true,
    data: {
      updatedCount: result.count,
      message: `${result.count} notification(s) marked as read`,
    },
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
