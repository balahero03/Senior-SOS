// backend/src/services/notificationService.js
// Centralized notification creation service for SeniorSOS.
// Writes to PostgreSQL `notifications` table using Prisma.

'use strict';

const { prisma } = require('../database/postgres');

/**
 * Creates an in-app notification in PostgreSQL.
 *
 * @param {Object} params
 * @param {string} params.recipientId - Target user UUID receiving the alert
 * @param {string} [params.actorId] - User UUID who triggered the action (optional)
 * @param {string} params.type - Notification type string (e.g. 'CONNECTION_REQUEST_RECEIVED')
 * @param {Object} [params.payload] - Additional metadata/context (JSON serializable)
 * @returns {Promise<Object|null>} The created notification record or null on error
 */
async function createNotification({ recipientId, actorId = null, type, payload = {} }) {
  // Guard against sending notification to oneself
  if (actorId && recipientId === actorId) {
    return null;
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        recipientId,
        actorId,
        type,
        payload,
      },
    });

    return notification;
  } catch (err) {
    // Notifications should not crash the primary transactional flow
    console.error(`[notificationService] Error creating notification of type "${type}":`, err.message);
    return null;
  }
}

module.exports = {
  createNotification,
};
