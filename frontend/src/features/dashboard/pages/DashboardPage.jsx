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
  const modules = [
    { tag: 'DB', status: '✓ Live', title: 'Identity & Auth', description: 'PostgreSQL: Users, roles, academic/alumni profiles, httpOnly JWT auth.' },
    { tag: 'CM', status: '✓ Live', title: 'Content & Chat', description: 'MongoDB: Posts, comments, reactions, conversations, and messages.', to: '/feed' },
    { tag: 'NG', status: 'Coming Soon', title: 'Network Graph', description: 'Neo4j: Multi-hop connection paths between alumni and students.' },
    { tag: 'RC', status: 'Coming Soon', title: 'Redis Cache', description: 'In-memory cache for sessions, rate-limiting, and WebSocket events.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Welcome Banner */}
        <div className="dashboard-hero mb-8 p-7 sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <span className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              Your SeniorSOS network
            </span>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Good to see you, {displayName}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {user?.role === 'STUDENT'
                ? 'Connect with alumni mentors and explore career guidance from your college network.'
                : 'Share your professional expertise, mentor rising students, and help top talent from your alma mater.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/feed"
                className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
              >
                Browse Feed
              </Link>
              <Link
                to="/messages"
                className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
              >
                Messages
              </Link>
            </div>
          </div>
        </div>

        {/* Profile Card & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Account Details Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
              <div className="w-14 h-14 rounded-lg bg-blue-700 text-white flex items-center justify-center font-semibold text-xl">
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
          <section className="lg:col-span-2" aria-labelledby="modules-heading">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">System overview</p>
                <h2 id="modules-heading" className="mt-1 text-2xl font-semibold text-slate-900">Platform Modules</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {modules.map(({ tag, status, title, description, to }) => (
                <article key={tag} className="dashboard-module border-t border-slate-200 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs font-semibold tracking-wide text-blue-700">{tag}</span>
                    <span className={`text-xs font-medium ${status === '✓ Live' ? 'text-emerald-700' : 'text-slate-500'}`}>{status}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
                  {to && <Link to={to} className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Go to Feed →</Link>}
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
