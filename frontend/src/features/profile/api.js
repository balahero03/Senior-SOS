// frontend/src/features/profile/api.js
import api from '../../services/api';

export const getProfile = (userId) =>
  api.get(`/users/${userId}/profile`).then((r) => r.data.data);

export const updateProfile = (data) =>
  api.put('/users/profile', data).then((r) => r.data.data);

export const getDepartments = () =>
  api.get('/departments').then((r) => r.data.data.departments);

export const getCompanies = (q = '') =>
  api.get('/companies', { params: { q } }).then((r) => r.data.data.companies);

export const getSkills = (q = '') =>
  api.get('/skills', { params: { q } }).then((r) => r.data.data.skills);

export const sendConnectionRequest = (targetUserId) =>
  api.post('/connections/request', { targetUserId }).then((r) => r.data.data);
