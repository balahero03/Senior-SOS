// frontend/src/services/api.js
// Shared Axios instance used by all feature API modules.
// Per FOLDER_STRUCTURE.md §frontend/src/services/:
//   "Shared communication setup, especially the Axios instance, base URL,
//    cookie credentials, and common request/response handling."

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,   // Send httpOnly cookies on every request
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Response interceptor: handle 401 with token refresh ─────────────────────
// When the access token expires (401), automatically try /auth/refresh.
// If refresh succeeds, retry the original request once.
// If refresh fails, the user is signed out.

let isRefreshing = false;
let failedQueue = [];

function processQueue(error) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh for 401 errors, not for /auth/refresh, /auth/login, or /auth/me itself
    // (prevents infinite refresh and reload loops on public routes like /login)
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retried &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/me')
    ) {
      if (isRefreshing) {
        // Queue subsequent 401s while a refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retried = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Only redirect if not already on /login or /register
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
