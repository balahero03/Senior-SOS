// frontend/src/features/admin/api.js
import api from '../../services/api';

/**
 * Fetch high-level platform stats across users, roles, verifications, and posts.
 */
export const getAdminStats = () =>
  api.get('/admin/stats').then((r) => r.data.data.stats);

/**
 * Fetch all alumni profiles pending admin verification.
 */
export const getPendingVerifications = () =>
  api.get('/admin/verifications').then((r) => r.data.data.verifications);

/**
 * Approve or reject an alumni verification application.
 * @param {string} id - User ID of the alumnus
 * @param {'APPROVED' | 'REJECTED'} status
 */
export const reviewVerification = (id, status) =>
  api.patch(`/admin/verifications/${id}`, { status }).then((r) => r.data.data);

/**
 * Fetch paginated and filterable list of users for administration.
 * @param {object} params - { q, role, page, limit }
 */
export const getUsersList = (params = {}) =>
  api.get('/users', { params }).then((r) => r.data.data);

/**
 * Update user account status (e.g., ACTIVE or SUSPENDED).
 * @param {string} id - User ID
 * @param {'ACTIVE' | 'SUSPENDED'} status
 */
export const updateUserStatus = (id, status) =>
  api.patch(`/admin/users/${id}/status`, { status }).then((r) => r.data.data);

/**
 * Fetch system audit logs.
 * @param {object} params - { page, limit }
 */
export const getAuditLogs = (params = {}) =>
  api.get('/admin/audit-logs', { params }).then((r) => r.data.data);

/**
 * Create a new academic department.
 * @param {{ code: string, name: string }} data
 */
export const createDepartment = (data) =>
  api.post('/admin/departments', data).then((r) => r.data.data);

/**
 * Register a new employer company.
 * @param {{ name: string }} data
 */
export const createCompany = (data) =>
  api.post('/admin/companies', data).then((r) => r.data.data);

/**
 * Fetch all registered departments.
 */
export const getDepartmentsList = () =>
  api.get('/departments').then((r) => r.data.data.departments);

/**
 * Fetch registered companies.
 * @param {string} [q]
 */
export const getCompaniesList = (q) =>
  api.get('/companies', { params: q ? { q } : {} }).then((r) => r.data.data.companies);


/**
 * Fetch API transcript entries with filters.
 * @param {object} params - { date, from, to, session, user, role, method, path, status, minMs, q, page, limit }
 */
export const getApiLogs = (params = {}) =>
  api.get('/admin/logs', { params }).then((r) => r.data.data);

/**
 * Fetch the values needed to populate the log filter dropdowns.
 */
export const getApiLogsMeta = () =>
  api.get('/admin/logs/meta').then((r) => r.data.data);

/**
 * Absolute URL for downloading one day's raw .txt log.
 * @param {string} date - YYYY-MM-DD
 */
export const apiLogDownloadUrl = (date) =>
  `${api.defaults.baseURL}/admin/logs/download?date=${encodeURIComponent(date)}`;
