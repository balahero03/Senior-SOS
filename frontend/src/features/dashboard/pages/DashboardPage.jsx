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
        <div className="dashboard-hero mb-8 p-7 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#b9d5d7]">
              <span className="h-px w-7 bg-[#c58a62]" aria-hidden="true" />
              Your SeniorSOS network
            </span>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Good to see you, {displayName}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#d0dfdf] sm:text-base">
              {user?.role === 'STUDENT'
                ? 'Connect with alumni mentors, explore career guidance, and get referred to top tech opportunities.'
                : 'Share your professional expertise, mentor rising students, and help top talent from your alma mater.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/feed"
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#1e4350] transition-colors hover:bg-[#edf4f3]"
              >
                Browse Feed
              </Link>
              <Link
                to="/messages"
                className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Messages
              </Link>
            </div>
          </div>
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
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-[0.65rem] font-bold text-blue-800 transition-colors group-hover:bg-blue-700 group-hover:text-white">CF</span>
                <span className="text-sm font-medium">Community Feed</span>
              </Link>
              <Link
                to="/messages"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-[0.65rem] font-bold text-indigo-800 transition-colors group-hover:bg-indigo-700 group-hover:text-white">DM</span>
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
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-800">DB</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">✓ Live</span>
                </div>
                <h4 className="font-bold text-slate-900">Identity & Auth</h4>
                <p className="text-xs text-slate-500 mt-1">PostgreSQL: Users, roles, academic/alumni profiles, httpOnly JWT auth.</p>
              </div>

              {/* MongoDB Content — Live */}
              <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xs font-bold text-emerald-800">CM</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">✓ Live</span>
                </div>
                <h4 className="font-bold text-slate-900">Content & Chat</h4>
                <p className="text-xs text-slate-500 mt-1">MongoDB: Posts, comments, reactions, conversations, and messages.</p>
                <Link to="/feed" className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline">Go to Feed →</Link>
              </div>

              {/* Neo4j Graph */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm opacity-75">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xs font-bold text-amber-800">NG</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">Coming Soon</span>
                </div>
                <h4 className="font-bold text-slate-900">Network Graph</h4>
                <p className="text-xs text-slate-500 mt-1">Neo4j: Multi-hop connection paths and alumni referral pathways.</p>
              </div>

              {/* Redis */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm opacity-75">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-xs font-bold text-red-800">RC</span>
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
