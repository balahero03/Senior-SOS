// frontend/src/features/notifications/api.js
import api from '../../services/api';

export const getNotifications = (params = {}) =>
  api.get('/notifications', { params }).then((r) => r.data.data);

export const markAsRead = (id) =>
  api.patch(`/notifications/${id}/read`).then((r) => r.data.data.notification);

export const markAllAsRead = () =>
  api.patch('/notifications/read-all').then((r) => r.data.data);
