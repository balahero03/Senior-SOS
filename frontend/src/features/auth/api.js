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
 * Fetch departments for the register and forgot password forms.
 * Queries PostgreSQL via /departments with graceful fallback.
 */
export async function getDepartments() {
  try {
    const response = await api.get('/departments');
    if (response.data?.data?.departments && response.data.data.departments.length > 0) {
      return response.data.data.departments;
    }
  } catch (_err) {
    // Fallback if offline or endpoint unreachable
  }
  return [
    { id: 'IT',    code: 'IT',    name: 'Information Technology' },
    { id: 'CSE',   code: 'CSE',   name: 'Computer Science & Engineering' },
    { id: 'ECE',   code: 'ECE',   name: 'Electronics & Communication Engineering' },
    { id: 'MECH',  code: 'MECH',  name: 'Mechanical Engineering' },
    { id: 'CIVIL', code: 'CIVIL', name: 'Civil Engineering' },
  ];
}

/**
 * Reset password via email and department verification.
 * @param {{ email: string, departmentId: string, newPassword: string, confirmPassword: string }} data
 */
export async function resetPassword(data) {
  const response = await api.post('/auth/reset-password', data);
  return response.data;
}

