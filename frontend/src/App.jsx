// frontend/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import FeedPage from './features/community/pages/FeedPage';
import MessagesPage from './features/messages/pages/MessagesPage';
import ProfilePage from './features/profile/pages/ProfilePage';
import DiscoverPage from './features/discover/pages/DiscoverPage';
import NetworkPage from './features/networking/pages/NetworkPage';
import MentorshipPage from './features/mentorship/pages/MentorshipPage';
import ReferralsPage from './features/referrals/pages/ReferralsPage';
import ProtectedRoute from './components/layout/ProtectedRoute';

export default function App() {
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

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
          path="/network"
          element={
            <ProtectedRoute>
              <NetworkPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentorship"
          element={
            <ProtectedRoute>
              <MentorshipPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/referrals"
          element={
            <ProtectedRoute>
              <ReferralsPage />
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
          path="/feed"
          element={
            <ProtectedRoute>
              <FeedPage />
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

        {/* Default route redirects to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
