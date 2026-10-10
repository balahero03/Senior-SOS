// frontend/src/features/auth/api.js
// Auth-specific API calls. Uses the shared Axios instance.
// Per FOLDER_STRUCTURE.md: "Feature-specific endpoint calls belong in the
//   matching feature's api.js and use this shared client."

import api from '../../services/api';

/**
 * Register a new user.
 * @param {object} data  { name, email, password, confirmPassword, role,
 *                         departmentId, graduationYear, bio?, careerInterests?,
 *                         company?, designation?, experienceYears? }
 */
export async function registerUser(data) {
  const response = await api.post('/auth/register', data);
  return response.data;
}

/**
 * Login with email + password.
 * @param {{ email: string, password: string }} credentials
 */
export async function loginUser(credentials) {
  const response = await api.post('/auth/login', credentials);
  return response.data;
}

/**
 * Logout (revoke refresh token, clear cookies).
 */
export async function logoutUser() {
  const response = await api.post('/auth/logout');
  return response.data;
}

/**
 * Fetch departments for the register form.
 * Departments live in PostgreSQL — fetched via the users module later.
 * For now, returns hardcoded list that matches the seeded departments.
 */
export async function getDepartments() {
  return [
    { id: 'IT',    code: 'IT',    name: 'Information Technology' },
    { id: 'CSE',   code: 'CSE',   name: 'Computer Science & Engineering' },
    { id: 'ECE',   code: 'ECE',   name: 'Electronics & Communication Engineering' },
    { id: 'MECH',  code: 'MECH',  name: 'Mechanical Engineering' },
    { id: 'CIVIL', code: 'CIVIL', name: 'Civil Engineering' },
  ];
}
