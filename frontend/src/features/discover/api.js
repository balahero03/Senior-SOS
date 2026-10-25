// frontend/src/features/discover/api.js
import api from '../../services/api';

export const getDiscoverUsers = (params = {}) =>
  api.get('/users', { params }).then((r) => r.data.data);

export const getDepartments = () =>
  api.get('/departments').then((r) => r.data.data.departments);

export const sendConnectionRequest = (targetUserId) =>
  api.post('/connections/request', { targetUserId }).then((r) => r.data.data);

/**
 * Best-fit alumni for the signed-in student, scored against their skills,
 * interests, department and network.
 * @param {{ limit?: number, interest?: string, companyId?: string,
 *           departmentId?: string, skillId?: string }} params
 */
export const getAlumniMatches = (params = {}) =>
  api.get('/match/alumni', { params }).then((r) => r.data.data);

export const getCompanies = (q) =>
  api.get('/companies', { params: q ? { q } : {} }).then((r) => r.data.data.companies);

export const getSkills = (q) =>
  api.get('/skills', { params: q ? { q } : {} }).then((r) => r.data.data.skills);

/**
 * "People like you": students see students, alumni see alumni and/or students.
 * @param {{ limit?: number, role?: 'ALL'|'ALUMNI'|'STUDENT', interest?: string,
 *           skillId?: string, departmentId?: string, companyId?: string }} params
 */
export const getPeerMatches = (params = {}) =>
  api.get('/match/peers', { params }).then((r) => r.data.data);
