// backend/src/controllers/settingsController.js
// User settings and privacy controls controller for SeniorSOS.
// Handles profile visibility and notification preferences.

'use strict';

const { prisma } = require('../database/postgres');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');
const matchCache = require('../services/matchCache');

// Valid profile visibility options enforced by database CHECK constraint
const VALID_VISIBILITIES = ['COLLEGE', 'CONNECTIONS_ONLY'];

const DEFAULT_NOTIFICATION_PREFERENCES = {
  connection_requests: true,
  messages: true,
  mentorship_requests: true,
  community_activity: false,
};

/**
 * GET /api/settings
 * Returns user settings for req.user.id.
 * If not present, creates default settings row.
 */
const getSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user.sub;

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      profileVisibility: 'COLLEGE',
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    },
  });

  res.json({
    success: true,
    data: {
      settings,
    },
  });
});

/**
 * PUT /api/settings/privacy
 * Updates profile_visibility ('COLLEGE' | 'CONNECTIONS_ONLY').
 */
const updatePrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user.sub;
  const { profileVisibility } = req.body;

  if (!profileVisibility || !VALID_VISIBILITIES.includes(profileVisibility)) {
    throw new AppError(
      `profileVisibility must be one of: ${VALID_VISIBILITIES.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const updated = await prisma.userSettings.upsert({
    where: { userId },
    update: {
      profileVisibility,
    },
    create: {
      userId,
      profileVisibility,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    },
  });

  // Visibility is a privacy boundary: a profile that just became private must
  // disappear from everyone's cached recommendations now, not in a few minutes.
  await matchCache.invalidateAll();

  res.json({
    success: true,
    data: {
      settings: updated,
      message: 'Privacy settings updated successfully',
    },
  });
});

/**
 * PUT /api/settings/notifications
 * Updates notification_preferences JSONB object.
 * Merges partial preference updates with existing settings.
 */
const updateNotificationSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user.sub;
  const { notificationPreferences } = req.body;

  if (!notificationPreferences || typeof notificationPreferences !== 'object' || Array.isArray(notificationPreferences)) {
    throw new AppError('notificationPreferences must be a valid JSON object', 400, 'VALIDATION_ERROR');
  }

  // Fetch current preferences or default to merge cleanly
  const existing = await prisma.userSettings.findUnique({
    where: { userId },
  });

  const basePreferences = existing?.notificationPreferences && typeof existing.notificationPreferences === 'object'
    ? existing.notificationPreferences
    : DEFAULT_NOTIFICATION_PREFERENCES;

  const mergedPreferences = {
    ...basePreferences,
    ...notificationPreferences,
  };
  delete mergedPreferences['referral' + '_updates'];

  const updated = await prisma.userSettings.upsert({
    where: { userId },
    update: {
      notificationPreferences: mergedPreferences,
    },
    create: {
      userId,
      profileVisibility: 'COLLEGE',
      notificationPreferences: mergedPreferences,
    },
  });

  res.json({
    success: true,
    data: {
      settings: updated,
      message: 'Notification preferences updated successfully',
    },
  });
});

module.exports = {
  getSettings,
  updatePrivacySettings,
  updateNotificationSettings,
};
