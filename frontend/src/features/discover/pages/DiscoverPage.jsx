// frontend/src/features/discover/pages/DiscoverPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../../components/layout/Navbar';
import PageHeading from '../../../components/ui/PageHeading';
import Icon from '../../../components/ui/Icon';
import MemberCard from '../components/MemberCard';
import { getDiscoverUsers, getDepartments } from '../api';

export default function DiscoverPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [departments, setDepartments] = useState([]);

  // Filter States
  const [role, setRole] = useState(''); // '' (All), 'STUDENT', 'ALUMNI'
  const [departmentId, setDepartmentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // Debounce search query input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load departments once
  useEffect(() => {
    getDepartments()
      .then((d) => setDepartments(d || []))
      .catch((err) => console.error('Failed to load departments', err));
  }, []);

  const fetchUsers = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = {
          page,
          limit: 12,
          ...(role && { role }),
          ...(departmentId && { departmentId }),
          ...(debouncedSearch.trim() && { q: debouncedSearch.trim() }),
          ...(verifiedOnly && { verifiedOnly: 'true' }),
        };

        const res = await getDiscoverUsers(params);
        setUsers(res.users || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        console.error('Failed to load discovery users:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [role, departmentId, debouncedSearch, verifiedOnly]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchUsers(newPage);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeading
          eyebrow="Network directory"
          title="Discover Campus Members"
          description="Find alumni mentors, connect with fellow students, and build your professional network."
        />

        {/* Filter Bar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, interests, or bio..."
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            {/* Department Filter */}
            <div className="md:col-span-4">
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Filter Buttons */}
            <div className="md:col-span-3 flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  role === '' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  role === 'STUDENT'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Students
              </button>
              <button
                type="button"
                onClick={() => setRole('ALUMNI')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  role === 'ALUMNI'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Alumni
              </button>
            </div>
          </div>

          {/* Verified Alumni toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4"
              />
              <span>Only show verified alumni</span>
            </label>

            <span className="text-xs text-slate-400 font-medium">
              Found {pagination.total} member{pagination.total === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Member Grid / Loading / Empty States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Searching members...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <span className="text-4xl block">🔍</span>
            <h3 className="text-base font-bold text-slate-800">No members match your search</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your role or department filter, or search with different keywords.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {users.map((user) => (
              <MemberCard
                key={user.id}
                user={user}
                onConnected={() => {
                  setUsers((prev) =>
                    prev.map((u) => (u.id === user.id ? { ...u, connectionStatus: 'PENDING_SENT' } : u))
                  );
                }}
              />
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              Previous
            </button>
            <span className="text-xs font-medium text-slate-500 px-3">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
