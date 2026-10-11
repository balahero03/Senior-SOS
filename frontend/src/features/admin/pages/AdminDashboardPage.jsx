// frontend/src/features/admin/pages/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar';
import PageHeading from '../../../components/ui/PageHeading';
import useAuthStore from '../../../stores/authStore';
import {
  getAdminStats,
  getPendingVerifications,
  reviewVerification,
  getUsersList,
  updateUserStatus,
} from '../api';

export default function AdminDashboardPage() {
  const { user: currentUser } = useAuthStore();

  // Route protection safety check: must be ADMIN
  if (currentUser && currentUser.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const [activeTab, setActiveTab] = useState('verifications'); // 'verifications' | 'users'
  const [stats, setStats] = useState({
    totalUsers: 0,
    studentsCount: 0,
    alumniCount: 0,
    pendingVerifications: 0,
    activePosts: 0,
  });
  const [verifications, setVerifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, verifsData] = await Promise.all([
        getAdminStats().catch(() => null),
        getPendingVerifications().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      setVerifications(verifsData || []);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(
    async (page = 1) => {
      try {
        const params = { page, limit: 10 };
        if (searchQuery.trim()) params.q = searchQuery.trim();
        if (roleFilter) params.role = roleFilter;

        const data = await getUsersList(params);
        setUsers(data?.users || []);
        if (data?.pagination) {
          setPagination(data.pagination);
        }
      } catch (err) {
        console.error('Failed to load users list:', err);
      }
    },
    [searchQuery, roleFilter]
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(1);
    }
  }, [activeTab, loadUsers]);

  const handleReview = async (targetUserId, status, applicantName) => {
    const isApprove = status === 'APPROVED';
    if (!window.confirm(`Are you sure you want to ${isApprove ? 'APPROVE' : 'REJECT'} verification for ${applicantName || 'this alumnus'}?`)) {
      return;
    }

    setActionLoadingId(targetUserId);
    try {
      await reviewVerification(targetUserId, status);
      showFeedback(`Successfully ${isApprove ? 'approved' : 'rejected'} ${applicantName || 'alumnus'}`);
      // Refresh verification queue and aggregate stats
      await loadDashboardData();
    } catch (err) {
      console.error('Verification review failed:', err);
      showFeedback(err.response?.data?.error?.message || 'Review failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleUserStatus = async (user) => {
    if (user.id === currentUser?.id) {
      alert('You cannot suspend your own admin account.');
      return;
    }

    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg =
      nextStatus === 'SUSPENDED'
        ? `Are you sure you want to SUSPEND ${user.name}? They will be blocked from logging in.`
        : `Reactivate account for ${user.name}?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(user.id);
    try {
      await updateUserStatus(user.id, nextStatus);
      showFeedback(`${user.name} is now ${nextStatus.toLowerCase()}`);
      await loadUsers(pagination.page);
    } catch (err) {
      console.error('User status update failed:', err);
      showFeedback(err.response?.data?.error?.message || 'Failed to update user status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadUsers(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Feedback */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        <PageHeading
          eyebrow="Platform admin"
          title="Admin Control Center"
          description="Oversee campus membership, approve alumni credentials, and manage system health."
          actions={<button
            onClick={() => {
              loadDashboardData();
              if (activeTab === 'users') loadUsers(pagination.page);
            }}
            className="page-action page-action-secondary"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh data
          </button>}
        />

        {/* 5 High-Level Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Total Users */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Users</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.totalUsers}</p>
            <p className="text-xs text-slate-400 mt-0.5">Registered accounts</p>
          </div>

          {/* Students */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Students</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.studentsCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Enrolled learners</p>
          </div>

          {/* Alumni */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alumni</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.alumniCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Graduated mentors</p>
          </div>

          {/* Pending Verifications */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Queue</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-2xl font-black text-slate-900">{stats.pendingVerifications}</p>
              {stats.pendingVerifications > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                  Action
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Pending alumni review</p>
          </div>

          {/* Feed Posts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Feed Posts</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.activePosts}</p>
            <p className="text-xs text-slate-400 mt-0.5">Community discussions</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('verifications')}
            className={`pb-3 px-4 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'verifications'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Alumni Verification Queue
            {verifications.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                {verifications.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-4 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            User Management
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {stats.totalUsers}
            </span>
          </button>
        </div>

        {/* TAB 1: Alumni Verification Queue */}
        {activeTab === 'verifications' && (
          <div>
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">Loading pending verifications...</div>
            ) : verifications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Verification Queue is Empty</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  All alumni registration submissions have been reviewed. New verification requests will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {verifications.map((item) => {
                  const isOperating = actionLoadingId === item.userId;
                  return (
                    <div
                      key={item.userId}
                      className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        {/* Top row: Name, initials, email */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
                              {item.name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-slate-900 leading-tight">{item.name}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">{item.email}</p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Review
                          </span>
                        </div>

                        {/* Details grid */}
                        <div className="space-y-2 py-3 border-y border-slate-100 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Company:</span>
                            <span className="font-semibold text-slate-800">{item.company || 'Not Specified'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Designation:</span>
                            <span className="font-semibold text-slate-800">{item.designation || 'Alumnus'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Department:</span>
                            <span className="font-medium text-slate-700">
                              {item.departmentName || item.department || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Graduation Year:</span>
                            <span className="font-medium text-slate-700">{item.graduationYear || 'N/A'}</span>
                          </div>
                          {item.experienceYears !== null && item.experienceYears !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Experience:</span>
                              <span className="font-medium text-slate-700">{item.experienceYears} Years</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-5 pt-2 flex items-center gap-3">
                        <button
                          disabled={isOperating}
                          onClick={() => handleReview(item.userId, 'APPROVED', item.name)}
                          className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve
                        </button>
                        <button
                          disabled={isOperating}
                          onClick={() => handleReview(item.userId, 'REJECTED', item.name)}
                          className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: User Management */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search and Role Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users by name, email, or skill..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Search
                </button>
              </form>

              <div className="w-full md:w-auto flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Role:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">All Roles</option>
                  <option value="STUDENT">Students</option>
                  <option value="ALUMNI">Alumni</option>
                  <option value="ADMIN">Admins</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">User</th>
                      <th className="py-3.5 px-6">Role</th>
                      <th className="py-3.5 px-6">Department / Affiliation</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          No users found matching query
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        const isOperating = actionLoadingId === u.id;
                        const isActive = u.status === 'ACTIVE';

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* User details */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                                  {u.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                                    {u.name}
                                    {isSelf && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Role */}
                            <td className="py-4 px-6">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  u.role === 'ADMIN'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : u.role === 'ALUMNI'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>

                            {/* Affiliation */}
                            <td className="py-4 px-6 text-xs text-slate-600">
                              {u.role === 'ALUMNI' ? (
                                <div>
                                  <p className="font-medium text-slate-800">{u.company || 'Alumnus'}</p>
                                  <p className="text-slate-500">{u.designation || u.department || 'N/A'}</p>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-medium text-slate-800">{u.department || 'Student'}</p>
                                  <p className="text-slate-500">Grad: {u.graduationYear || 'N/A'}</p>
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-4 px-6">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isActive ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                />
                                {u.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-6 text-right">
                              {isSelf ? (
                                <span className="text-xs text-slate-400 italic">Protected</span>
                              ) : (
                                <button
                                  disabled={isOperating}
                                  onClick={() => handleToggleUserStatus(u)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shadow-sm disabled:opacity-50 ${
                                    isActive
                                      ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                      : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                >
                                  {isOperating
                                    ? 'Updating...'
                                    : isActive
                                    ? 'Suspend'
                                    : 'Reactivate'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total accounts)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => loadUsers(pagination.page - 1)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadUsers(pagination.page + 1)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
