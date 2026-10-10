// frontend/src/features/discover/api.js
import api from '../../services/api';

export const getDiscoverUsers = (params = {}) =>
  api.get('/users', { params }).then((r) => r.data.data);

export const getDepartments = () =>
  api.get('/departments').then((r) => r.data.data.departments);

export const sendConnectionRequest = (targetUserId) =>
  api.post('/connections/request', { targetUserId }).then((r) => r.data.data);
