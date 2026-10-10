// frontend/src/features/dashboard/pages/DashboardPage.jsx
import React from 'react';
import useAuthStore from '../../../stores/authStore';
import Navbar from '../../../components/layout/Navbar';

export default function DashboardPage() {
  const { user } = useAuthStore();

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
              Hello, {user?.firstName} {user?.lastName}! 👋
            </h1>
            <p className="mt-3 text-blue-100 text-base sm:text-lg leading-relaxed">
              {user?.role === 'STUDENT'
                ? 'Connect with alumni mentors, explore career guidance, and get referred to top tech opportunities.'
                : 'Share your professional expertise, mentor rising students, and help top talent from your alma mater.'}
            </p>
          </div>
          {/* Decorative SVG elements */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Profile Card & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Account Details Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
                {user?.firstName ? user.firstName[0].toUpperCase() : 'U'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {user?.firstName} {user?.lastName}
                </h2>
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

              {user?.role === 'STUDENT' && user?.studentProfile && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Major</p>
                    <p className="font-medium text-slate-800 mt-0.5">{user.studentProfile.major}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expected Graduation</p>
                    <p className="font-medium text-slate-800 mt-0.5">{user.studentProfile.expectedGradYear}</p>
                  </div>
                </>
              )}

              {user?.role === 'ALUMNI' && user?.alumniProfile && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Graduation Year</p>
                    <p className="font-medium text-slate-800 mt-0.5">{user.alumniProfile.degreeYear}</p>
                  </div>
                  {user.alumniProfile.company && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Company</p>
                      <p className="font-medium text-slate-800 mt-0.5">{user.alumniProfile.company.name}</p>
                    </div>
                  )}
                  {user.alumniProfile.jobTitle && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role / Title</p>
                      <p className="font-medium text-slate-800 mt-0.5">{user.alumniProfile.jobTitle}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Platform Feature Status Cards */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-slate-900">
              Module Status & Architecture Overview
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* PostgreSQL Auth Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    🐘
                  </span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                    Implemented & Live
                  </span>
                </div>
                <h4 className="font-bold text-slate-900">PostgreSQL Identity & Auth</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Single source of truth for user authentication, roles (STUDENT / ALUMNI), student/alumni profiles, and secure httpOnly JWT cookies.
                </p>
              </div>

              {/* MongoDB Content Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all opacity-80">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    🍃
                  </span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">
                    Next Database Phase
                  </span>
                </div>
                <h4 className="font-bold text-slate-900">MongoDB Content & Chat</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Document store for posts, comments, reactions, conversations, and real-time chat message history.
                </p>
              </div>

              {/* Neo4j Graph Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all opacity-80">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                    🕸️
                  </span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">
                    Derived Graph Phase
                  </span>
                </div>
                <h4 className="font-bold text-slate-900">Neo4j Network Graph</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Derived graph database for multi-hop connection paths, mutual network discovery, and alumni referral pathways.
                </p>
              </div>

              {/* Redis Cache Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all opacity-80">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    ⚡
                  </span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">
                    Caching & Session Phase
                  </span>
                </div>
                <h4 className="font-bold text-slate-900">Redis Cache & PubSub</h4>
                <p className="text-xs text-slate-500 mt-1">
                  In-memory cache for fast session verification, rate-limiting, and WebSocket event broadcasting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
