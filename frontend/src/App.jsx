// frontend/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import MessagesPage from './features/messages/pages/MessagesPage';
import ProfilePage from './features/profile/pages/ProfilePage';
import DiscoverPage from './features/discover/pages/DiscoverPage';
import BestFitPage from './features/discover/pages/BestFitPage';
import PeersPage from './features/discover/pages/PeersPage';
import NetworkPage from './features/networking/pages/NetworkPage';
import NetworkGraphPage from './features/networking/pages/NetworkGraphPage';
import NotificationsPage from './features/notifications/pages/NotificationsPage';
import AdminDashboardPage from './features/admin/pages/AdminDashboardPage';
import SettingsPage from './features/settings/pages/SettingsPage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { connectSocket, disconnectSocket } from './services/socket';

export default function App() {
  const initAuth = useAuthStore((state) => state.initAuth);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Stay connected to the realtime server while signed in, so a user shows as
  // online on every page and not only while the Messages page is open.
  useEffect(() => {
    if (user) {
      connectSocket();
      return () => disconnectSocket();
    }
    return undefined;
  }, [user?.id]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected app routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <DiscoverPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/best-fit"
          element={
            <ProtectedRoute>
              <BestFitPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/connect"
          element={
            <ProtectedRoute>
              <PeersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/network"
          element={
            <ProtectedRoute>
              <NetworkPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/network/graph"
          element={
            // Administrators only. explainDenial so a student who follows an
            // old link is told why, rather than being bounced silently.
            <ProtectedRoute requiredRole="ADMIN" explainDenial>
              <NetworkGraphPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect removed feed and mentorship routes to main dashboard */}
        <Route path="/feed" element={<Navigate to="/dashboard" replace />} />
        <Route path="/mentorship" element={<Navigate to="/dashboard" replace />} />

        {/* Default route redirects role-aware */}
        <Route path="/" element={<Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />} />
        <Route path="*" element={<Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
