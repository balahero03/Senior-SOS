// frontend/src/features/mentorship/api.js
import api from '../../services/api';

export const getMyMentorships = () =>
  api.get('/mentorship/my-mentorships').then((r) => r.data.data.mentorships);

export const requestMentorship = (data) =>
  api.post('/mentorship/request', data).then((r) => r.data.data.mentorship);

export const updateMentorshipStatus = (id, status) =>
  api.patch(`/mentorship/${id}/status`, { status }).then((r) => r.data.data.mentorship);

export const getAlumniList = () =>
  api.get('/users', { params: { role: 'ALUMNI', limit: 50 } }).then((r) => r.data.data.users);
