// frontend/src/features/dashboard/pages/DashboardPage.jsx
import React from 'react';
import useAuthStore from '../../../stores/authStore';
import Navbar from '../../../components/layout/Navbar';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuthStore();

  // User model has single `name` field
  const displayName = user?.name || 'there';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 text-white p-8 sm:p-10 shadow-xl mb-8">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-white/20">
              Welcome back to SeniorSOS
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Hello, {displayName}! 👋
            </h1>
            <p className="mt-3 text-blue-100 text-base sm:text-lg leading-relaxed">
              {user?.role === 'STUDENT'
                ? 'Connect with alumni mentors, explore career guidance, and get referred to top tech opportunities.'
                : 'Share your professional expertise, mentor rising students, and help top talent from your alma mater.'}
            </p>
            <div className="flex gap-3 mt-6">
              <Link
                to="/feed"
                className="px-5 py-2.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors text-sm shadow-md"
              >
                Browse Feed
              </Link>
              <Link
                to="/messages"
                className="px-5 py-2.5 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-colors text-sm border border-white/30"
              >
                Messages
              </Link>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Profile Card & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Account Details Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
                {initials}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${
                  user?.role === 'ALUMNI' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${user?.role === 'ALUMNI' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {user?.role}
                </span>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</p>
                <p className="font-medium text-slate-800 mt-0.5">{user?.email}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account Status</p>
                <p className="font-medium text-slate-800 mt-0.5 capitalize">{user?.status?.toLowerCase() || 'Active'}</p>
              </div>

              {user?.academicProfile && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Graduation Year</p>
                  <p className="font-medium text-slate-800 mt-0.5">{user.academicProfile.graduationYear}</p>
                </div>
              )}

              {user?.alumniProfile?.company && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</p>
                  <p className="font-medium text-slate-800 mt-0.5">{user.alumniProfile.company.name}</p>
                </div>
              )}

              {user?.alumniProfile?.designation && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role / Title</p>
                  <p className="font-medium text-slate-800 mt-0.5">{user.alumniProfile.designation}</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="pt-2 space-y-2">
              <Link
                to="/feed"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors group"
              >
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">📋</span>
                <span className="text-sm font-medium">Community Feed</span>
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors group"
              >
                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">💬</span>
                <span className="text-sm font-medium">Direct Messages</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Platform Feature Status */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Platform Modules</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* PostgreSQL Auth — Live */}
              <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">🐘</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">✓ Live</span>
                </div>
                <h4 className="font-bold text-slate-900">Identity & Auth</h4>
                <p className="text-xs text-slate-500 mt-1">PostgreSQL: Users, roles, academic/alumni profiles, httpOnly JWT auth.</p>
              </div>

              {/* MongoDB Content — Live */}
              <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">🍃</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">✓ Live</span>
                </div>
                <h4 className="font-bold text-slate-900">Content & Chat</h4>
                <p className="text-xs text-slate-500 mt-1">MongoDB: Posts, comments, reactions, conversations, and messages.</p>
                <Link to="/feed" className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline">Go to Feed →</Link>
              </div>

              {/* Neo4j Graph */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm opacity-75">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">🕸️</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">Coming Soon</span>
                </div>
                <h4 className="font-bold text-slate-900">Network Graph</h4>
                <p className="text-xs text-slate-500 mt-1">Neo4j: Multi-hop connection paths and alumni referral pathways.</p>
              </div>

              {/* Redis */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm opacity-75">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">⚡</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">Coming Soon</span>
                </div>
                <h4 className="font-bold text-slate-900">Redis Cache</h4>
                <p className="text-xs text-slate-500 mt-1">In-memory cache for sessions, rate-limiting, and WebSocket events.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
