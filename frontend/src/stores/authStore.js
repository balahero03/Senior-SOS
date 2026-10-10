// frontend/src/stores/authStore.js
// Global Zustand store for the authenticated user.
// Per FOLDER_STRUCTURE.md §frontend/src/stores/:
//   "Global Zustand stores only when state must be shared across unrelated parts
//    of the app, such as current auth user."

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── State ─────────────────────────────────────────────────────────────
      user: null,
      isLoading: true,   // True until /me resolves on app boot
      isAuthenticated: false,

      // ── Actions ───────────────────────────────────────────────────────────

      /**
       * Called by the route guard on app mount to restore session.
       * Calls GET /api/auth/me using the access token cookie.
       * If the access token is expired, the Axios interceptor auto-refreshes.
       */
      async initAuth() {
        set({ isLoading: true });
        try {
          const response = await api.get('/auth/me');
          set({
            user: response.data.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      /**
       * Update store after a successful login or register response.
       * @param {{ user }} data
       */
      setUser(user) {
        set({ user, isAuthenticated: true, isLoading: false });
      },

      /**
       * Logout: call backend to revoke refresh token then clear store.
       */
      async logout() {
        try {
          await api.post('/auth/logout');
        } catch {
          // Best-effort — clear store regardless
        }
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-user',
      // Only persist non-sensitive user info (no tokens — they're in httpOnly cookies)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);

export default useAuthStore;
