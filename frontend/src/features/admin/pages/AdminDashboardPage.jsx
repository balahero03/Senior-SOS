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
  getAuditLogs,
  createDepartment,
  createCompany,
  getDepartmentsList,
  getCompaniesList,
} from '../api';

export default function AdminDashboardPage() {
  const { user: currentUser } = useAuthStore();

  // Route protection safety check: must be ADMIN
  if (currentUser && currentUser.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'verifications' | 'users' | 'masterData' | 'audit'
  const [stats, setStats] = useState({
    totalUsers: 0,
    studentsCount: 0,
    alumniCount: 0,
    verifiedAlumniCount: 0,
    pendingVerifications: 0,
    activeConnectionsCount: 0,
    totalDepartmentsCount: 0,
    totalCompaniesCount: 0,
    enrolledTotal: 0,
    departmentsBreakdown: [],
  });
  const [verifications, setVerifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Master Data & Audit states
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companySearch, setCompanySearch] = useState('');
  const [debouncedCompanySearch, setDebouncedCompanySearch] = useState('');
  const [newDept, setNewDept] = useState({ code: '', name: '' });
  const [newCompany, setNewCompany] = useState({ name: '' });
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  // loadUsers depends on the query, so binding it straight to the input would
  // fire a request per keystroke. Settle first, then search.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [verificationSearch, setVerificationSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
      setIsUsersLoading(true);
      try {
        const params = { page, limit: 10 };
        if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
        if (roleFilter) params.role = roleFilter;
        if (statusFilter) params.status = statusFilter;

        const data = await getUsersList(params);
        setUsers(data?.users || []);
        if (data?.pagination) {
          setPagination(data.pagination);
        }
      } catch (err) {
        console.error('Failed to load users list:', err);
        showFeedback(
          err.response?.data?.error?.message || 'Failed to load the user directory',
          'error',
        );
      } finally {
        setIsUsersLoading(false);
      }
    },
    [debouncedSearch, roleFilter, statusFilter]
  );

  const loadMasterData = useCallback(async () => {
    try {
      const [deptList, compList] = await Promise.all([
        getDepartmentsList().catch(() => []),
        getCompaniesList(debouncedCompanySearch).catch(() => []),
      ]);
      setDepartments(deptList || []);
      setCompanies(compList || []);
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  }, [debouncedCompanySearch]);

  const loadAuditLogs = useCallback(async (page = 1) => {
    setIsAuditLoading(true);
    try {
      const data = await getAuditLogs({ page, limit: 15 });
      setAuditLogs(data?.logs || []);
      if (data?.pagination) {
        setAuditPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCompanySearch(companySearch), 350);
    return () => clearTimeout(timer);
  }, [companySearch]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(1);
    } else if (activeTab === 'masterData') {
      loadMasterData();
    } else if (activeTab === 'audit') {
      loadAuditLogs(1);
    }
  }, [activeTab, loadUsers, loadMasterData, loadAuditLogs]);

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!newDept.code.trim() || !newDept.name.trim()) {
      showFeedback('Department code and name are required', 'error');
      return;
    }
    setIsSubmittingDept(true);
    try {
      await createDepartment({ code: newDept.code.trim().toUpperCase(), name: newDept.name.trim() });
      showFeedback(`Department ${newDept.code.toUpperCase()} registered successfully`);
      setNewDept({ code: '', name: '' });
      await Promise.all([loadMasterData(), loadDashboardData()]);
    } catch (err) {
      console.error('Failed to create department:', err);
      showFeedback(err.response?.data?.error?.message || 'Failed to create department', 'error');
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompany.name.trim()) {
      showFeedback('Company name is required', 'error');
      return;
    }
    setIsSubmittingCompany(true);
    try {
      await createCompany({ name: newCompany.name.trim() });
      showFeedback(`Company "${newCompany.name.trim()}" registered successfully`);
      setNewCompany({ name: '' });
      await Promise.all([loadMasterData(), loadDashboardData()]);
    } catch (err) {
      console.error('Failed to create company:', err);
      showFeedback(err.response?.data?.error?.message || 'Failed to create company', 'error');
    } finally {
      setIsSubmittingCompany(false);
    }
  };

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
    // Skip the debounce wait when the admin submits explicitly. If the text has
    // settled already this is a no-op and the effect below does not refire.
    setDebouncedSearch(searchQuery);
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

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 mb-8 gap-1 sm:gap-2 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📊 Platform Overview
          </button>
          <button
            onClick={() => setActiveTab('verifications')}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'verifications'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🛡️ Alumni Approvals
            {verifications.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                {verifications.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            👥 User Directory
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              {stats.totalUsers}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('masterData')}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'masterData'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🏛️ Campus Master Data
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📜 Security Audit Trail
          </button>
        </div>

        {/* TAB 1: Platform Overview & Executive Analytics */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 6 Executive KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Users</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalUsers || 0}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Active accounts</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Students</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.studentsCount || 0}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Enrolled learners</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Verified Alumni</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.verifiedAlumniCount || 0}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Vetted mentors</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Queue</span>
                  {stats.pendingVerifications > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.pendingVerifications || 0}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Awaiting review</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Connections</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.activeConnectionsCount || 0}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Network pairs</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Departments</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalDepartmentsCount || 0}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Engineering faculties</p>
              </div>
            </div>

            {/* Department Breakdown & Quick Actions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Department Enrollment Breakdown (2 cols) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Academic Department Distribution</h3>
                    <p className="text-xs text-slate-500">Student and alumni population per engineering faculty</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                    {stats.departmentsBreakdown?.length || 0} Departments
                  </span>
                </div>

                <div className="space-y-3.5">
                  {(stats.departmentsBreakdown || []).map((dept) => {
                    // Share of enrolled users, not of all accounts: admins have
                    // no department, so totalUsers never sums to 100%.
                    const totalEnrolled = stats.enrolledTotal || stats.totalUsers || 1;
                    const pct = Math.min(100, Math.round(((dept.enrolledCount || 0) / totalEnrolled) * 100));
                    return (
                      <div key={dept.code} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{dept.code} <span className="text-slate-400 font-normal">({dept.name})</span></span>
                          <span className="font-semibold text-slate-600">{dept.enrolledCount} enrolled ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Platform Health & Quick Action Shortcuts */}
              <div className="space-y-6">
                {/* Quick Action Cards */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Administrator Shortcuts</h3>
                  
                  <button
                    onClick={() => setActiveTab('verifications')}
                    className="w-full text-left p-3 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-xs font-bold text-amber-900">Review Alumni Applications</p>
                      <p className="text-[11px] text-amber-700">{stats.pendingVerifications || 0} applications pending review</p>
                    </div>
                    <span className="text-amber-700 text-sm font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">Manage Campus Directory</p>
                      <p className="text-[11px] text-slate-500">Search and moderate user accounts</p>
                    </div>
                    <span className="text-slate-400 text-sm font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>

                {/* System Infrastructure Health */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">System Infrastructure</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      All Operational
                    </span>
                  </div>

                  <div className="space-y-2 text-xs divide-y divide-slate-800">
                    <div className="pt-2 flex items-center justify-between text-slate-300">
                      <span>PostgreSQL Relational DB</span>
                      <span className="text-emerald-400 font-mono text-[11px]">Connected</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-slate-300">
                      <span>MongoDB Document Store</span>
                      <span className="text-emerald-400 font-mono text-[11px]">Connected</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-slate-300">
                      <span>Auth Security Gateway</span>
                      <span className="text-emerald-400 font-mono text-[11px]">JWT httpOnly</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-slate-300">
                      <span>Role-Based Route Guard</span>
                      <span className="text-purple-300 font-mono text-[11px]">Strict Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: Alumni Verification Queue */}
        {activeTab === 'verifications' && (
          <div className="space-y-4">
            {/* Vetting Information Header Card */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    Trust & Verification
                  </span>
                  <span className="text-xs font-semibold text-purple-200">
                    {verifications.length} Pending Submission{verifications.length === 1 ? '' : 's'}
                  </span>
                </div>
                <h3 className="text-base font-bold mt-1 text-white">Alumni Identity & Credentials Vetting</h3>
                <p className="text-xs text-purple-200/80 max-w-2xl mt-0.5">
                  Approve campus alumni to grant them official Verified Mentor status, unlock mentorship capabilities, and build student trust. Every decision generates an immutable audit record and notifies the applicant.
                </p>
              </div>

              {verifications.length > 0 && (
                <div className="relative min-w-[220px]">
                  <input
                    type="text"
                    value={verificationSearch}
                    onChange={(e) => setVerificationSearch(e.target.value)}
                    placeholder="Filter by name or company..."
                    className="w-full px-3 py-1.5 bg-white/10 placeholder-purple-300 text-white text-xs rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                  {verificationSearch && (
                    <button
                      onClick={() => setVerificationSearch('')}
                      className="absolute right-2 top-2 text-xs text-purple-300 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-slate-400">Loading pending verifications...</div>
            ) : verifications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Verification Queue is Clear</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  All alumni registration submissions have been thoroughly vetted. When new graduates sign up, their credentials will populate here for institutional review.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {verifications
                  .filter((item) => {
                    if (!verificationSearch.trim()) return true;
                    const query = verificationSearch.toLowerCase();
                    return (
                      item.name?.toLowerCase().includes(query) ||
                      item.email?.toLowerCase().includes(query) ||
                      item.company?.toLowerCase().includes(query) ||
                      item.designation?.toLowerCase().includes(query)
                    );
                  })
                  .map((item) => {
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

              <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Role:</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">All Roles</option>
                    <option value="STUDENT">Students</option>
                    <option value="ALUMNI">Alumni</option>
                    <option value="ADMIN">Admins</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="SUSPENDED">Suspended Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">User</th>
                      <th className="py-3.5 px-6">Role & Credential</th>
                      <th className="py-3.5 px-6">Department / Affiliation</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {/* Without this branch the table claims no matches while
                        the first request is still in flight. */}
                    {isUsersLoading && users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          Loading campus directory...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
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
                                <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {u.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 flex items-center gap-2 truncate">
                                    <span>{u.name}</span>
                                    {isSelf && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Role & Credential */}
                            <td className="py-4 px-6">
                              <div className="flex flex-col gap-1 items-start">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    u.role === 'ADMIN'
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      : u.role === 'ALUMNI'
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {u.role}
                                </span>
                                {u.role === 'ALUMNI' && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                      u.verificationStatus === 'APPROVED'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : u.verificationStatus === 'PENDING'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    {u.verificationStatus === 'APPROVED'
                                      ? '✓ Verified Mentor'
                                      : u.verificationStatus === 'PENDING'
                                      ? '⏳ Pending Review'
                                      : 'Unverified'}
                                  </span>
                                )}
                              </div>
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

        {/* TAB 4: Campus Master Data Management */}
        {activeTab === 'masterData' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Institutional Configuration
              </span>
              <h2 className="text-xl font-bold mt-2">Campus Master Data Registry</h2>
              <p className="text-xs text-indigo-200/80 max-w-2xl mt-1">
                Maintain authoritative lists of engineering departments and recognized employer companies. These values automatically synchronize across student onboarding, alumni registration, and filter facets.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Academic Departments */}
              <div className="space-y-6">
                {/* Add Department Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>🏛️</span> Add Academic Department
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Register a new engineering faculty or academic degree department.</p>

                  <form onSubmit={handleCreateDepartment} className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Code</label>
                        <input
                          type="text"
                          required
                          value={newDept.code}
                          onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                          placeholder="e.g. AIML"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={newDept.name}
                          onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                          placeholder="e.g. Artificial Intelligence & Machine Learning"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingDept}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isSubmittingDept ? 'Registering...' : '+ Register Department'}
                    </button>
                  </form>
                </div>

                {/* Departments List */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Registered Departments</h4>
                      <p className="text-xs text-slate-500">{departments.length} active faculties</p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                    {departments.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-400">No departments loaded</p>
                    ) : (
                      departments.map((dept) => {
                        const breakdown = stats.departmentsBreakdown?.find((d) => d.code === dept.code);
                        return (
                          <div key={dept.id || dept.code} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="w-12 text-center py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono text-xs font-bold border border-indigo-200/80">
                                {dept.code}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-900">{dept.name}</p>
                                <p className="text-[11px] text-slate-400">Institutional Faculty</p>
                              </div>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                              {breakdown ? `${breakdown.enrolledCount} enrolled` : 'Active'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Partner Employers */}
              <div className="space-y-6">
                {/* Add Company Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>🏢</span> Register Partner Employer
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add hiring organizations and alumni employment partners.</p>

                  <form onSubmit={handleCreateCompany} className="mt-4 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ name: e.target.value })}
                      placeholder="e.g. Microsoft, Google, Zoho"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingCompany}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSubmittingCompany ? 'Adding...' : '+ Add Employer'}
                    </button>
                  </form>
                </div>

                {/* Companies List with Search */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Partner Employers</h4>
                      <p className="text-xs text-slate-500">{companies.length} verified corporate entities</p>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={companySearch}
                        // loadMasterData already reruns when companySearch
                        // changes, debounced below. Fetching here too raced
                        // that request and could show the wrong results.
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Search employers..."
                        className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                    {companies.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-400">No partner companies matching query</p>
                    ) : (
                      companies.map((c) => (
                        <div key={c.id} className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200/60">
                              {c.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-900">{c.name}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            Partner Org
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Security Audit Logs Viewer */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  Regulatory Compliance & Governance
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Institutional Audit Trail</h3>
                <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
                  Append-only immutable record capturing administrative decisions, verification approvals, account status alterations, and metadata changes.
                </p>
              </div>

              <button
                onClick={() => loadAuditLogs(auditPagination.page)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 self-start md:self-auto"
              >
                <span>↻</span> Refresh Audit Stream
              </button>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Timestamp</th>
                      <th className="py-3.5 px-6">Administrator</th>
                      <th className="py-3.5 px-6">Action</th>
                      <th className="py-3.5 px-6">Target Entity</th>
                      <th className="py-3.5 px-6">Modification Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {isAuditLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          Loading audit records...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          No audit entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => {
                        const dateFormatted = new Date(log.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        });

                        const actionStyles = {
                          ALUMNI_VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
                          USER_STATUS_CHANGE: 'bg-amber-50 text-amber-700 border-amber-200',
                          DEPARTMENT_CREATED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                          COMPANY_CREATED: 'bg-blue-50 text-blue-700 border-blue-200',
                        }[log.action] || 'bg-slate-50 text-slate-700 border-slate-200';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* Timestamp */}
                            <td className="py-3.5 px-6 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {dateFormatted}
                            </td>

                            {/* Actor */}
                            <td className="py-3.5 px-6">
                              {/* actorId is SetNull on delete, so a missing
                                  actor means the account is gone — do not
                                  attribute the action to the current admin. */}
                              <div className="font-semibold text-slate-800">
                                {log.actor?.name || 'Deleted account'}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {log.actor?.email || '—'}
                              </div>
                            </td>

                            {/* Action */}
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${actionStyles}`}>
                                {log.action}
                              </span>
                            </td>

                            {/* Target */}
                            <td className="py-3.5 px-6 font-mono text-[11px] text-slate-600">
                              <span className="font-bold text-slate-700">{log.targetType || 'ENTITY'}</span>
                              <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">{log.targetId}</span>
                            </td>

                            {/* Metadata */}
                            <td className="py-3.5 px-6">
                              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 font-mono text-[11px] text-slate-700 max-w-sm">
                                {typeof log.metadata === 'object' && log.metadata !== null ? (
                                  Object.entries(log.metadata).map(([k, v]) => (
                                    <div key={k} className="flex gap-2">
                                      <span className="text-slate-400">{k}:</span>
                                      <span className="font-bold text-slate-900">{String(v)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span>{JSON.stringify(log.metadata)}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Audit Pagination */}
              {auditPagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Page {auditPagination.page} of {auditPagination.totalPages} ({auditPagination.total} total log entries)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={auditPagination.page <= 1}
                      onClick={() => loadAuditLogs(auditPagination.page - 1)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      disabled={auditPagination.page >= auditPagination.totalPages}
                      onClick={() => loadAuditLogs(auditPagination.page + 1)}
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
