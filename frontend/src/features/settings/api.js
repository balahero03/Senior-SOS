// frontend/src/features/settings/api.js
import api from '../../services/api';

/**
 * Fetch current user settings, privacy preferences, and notification toggles.
 */
export const getSettings = () =>
  api.get('/settings').then((r) => r.data.data.settings);

/**
 * Update user profile visibility preference.
 * @param {'COLLEGE' | 'CONNECTIONS_ONLY'} profileVisibility
 */
export const updatePrivacy = (profileVisibility) =>
  api.put('/settings/privacy', { profileVisibility }).then((r) => r.data.data.settings);

/**
 * Update user notification preferences.
 * @param {object} notificationPreferences - connection, mentorship, message, and community preferences
 */
export const updateNotificationPreferences = (notificationPreferences) =>
  api.put('/settings/notifications', { notificationPreferences }).then((r) => r.data.data.settings);

/**
 * Change account password.
 * @param {{ currentPassword: string, newPassword: string }} data
 */
export const changePassword = (data) =>
  api.post('/auth/change-password', data).then((r) => r.data);
