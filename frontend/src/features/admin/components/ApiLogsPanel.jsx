// frontend/src/features/admin/components/ApiLogsPanel.jsx
// Admin view over the API transcript written by requestLogger.middleware.
// Filters by session, date, role, method, status, path, duration and free
// text, and can download a day's raw .txt.

import React, { useState, useEffect, useCallback } from 'react';
import { getApiLogs, getApiLogsMeta, apiLogDownloadUrl } from '../api';

const EMPTY_FILTERS = {
  date: '', from: '', to: '', session: '', user: '', role: '',
  method: '', path: '', status: '', minMs: '', q: '',
};

function statusTone(status) {
  if (status >= 500) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status >= 400) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status >= 300) return 'bg-slate-50 text-slate-600 border-slate-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function roleTone(role) {
  if (role === 'ADMIN') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (role === 'ALUMNI') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (role === 'STUDENT') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
}

export default function ApiLogsPanel() {
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Free text hits every entry body, so it is debounced separately.
  const [queryInput, setQueryInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [expandedId, setExpandedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getApiLogsMeta()
      .then(setMeta)
      .catch(() => setMeta({ enabled: false }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: queryInput })), 350);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const loadLogs = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError('');
    try {
      // Drop empty values so the query string stays readable.
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v != null),
      );
      const data = await getApiLogs({ ...params, page, limit: 25 });
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load logs.');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadLogs(1); }, [loadLogs]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const activeCount = Object.values(filters).filter((v) => v !== '').length;

  if (meta && meta.enabled === false) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-4">
          ⚠
        </div>
        <h3 className="text-lg font-bold text-slate-800">Transcript logging is off</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Set <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">API_TRANSCRIPT_LOG=true</code>{' '}
          in <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">backend/.env</code> and restart
          the server. Logs record full request and response bodies, so keep this off in production.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/10 text-slate-200 border border-white/20">
            Diagnostics
          </span>
          <h3 className="text-base font-bold mt-1">API Request &amp; Response Transcript</h3>
          <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
            Every API call with its full request and response body. Bodies are recorded verbatim,
            so treat this view as sensitive.
          </p>
        </div>
        {meta?.dates?.length > 0 && (
          <a
            href={apiLogDownloadUrl(filters.date || meta.dates[0])}
            className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold hover:bg-white/20 transition-colors self-start md:self-auto whitespace-nowrap"
          >
            ↓ Download {filters.date || meta.dates[0]}.txt
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Filters {activeCount > 0 && <span className="text-[#0a66c2]">({activeCount} active)</span>}
          </h4>
          {activeCount > 0 && (
            <button
              onClick={() => { setFilters(EMPTY_FILTERS); setQueryInput(''); }}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <input
          type="text"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="Search anywhere in the request or response body…"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <select value={filters.session} onChange={set('session')} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All sessions</option>
            {(meta?.sessions || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 10)}… ({s.count}) {s.roles.join('/')}
              </option>
            ))}
          </select>

          <select value={filters.date} onChange={set('date')} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All dates</option>
            {(meta?.dates || []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={filters.role} onChange={set('role')} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All roles</option>
            {(meta?.roles || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <select value={filters.method} onChange={set('method')} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All methods</option>
            {(meta?.methods || []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={filters.status} onChange={set('status')} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All statuses</option>
            <option value="2xx">2xx success</option>
            <option value="3xx">3xx redirect</option>
            <option value="4xx">4xx client error</option>
            <option value="5xx">5xx server error</option>
          </select>

          <select value={filters.minMs} onChange={set('minMs')} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Any duration</option>
            <option value="100">≥ 100ms</option>
            <option value="500">≥ 500ms</option>
            <option value="1000">≥ 1s</option>
            <option value="3000">≥ 3s</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input type="text" value={filters.path} onChange={set('path')} placeholder="Path contains, e.g. /api/admin"
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <input type="text" value={filters.user} onChange={set('user')} placeholder="User id"
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <div className="flex items-center gap-2">
            <input type="date" value={filters.from} onChange={set('from')} title="From date"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <span className="text-xs text-slate-400">→</span>
            <input type="date" value={filters.to} onChange={set('to')} title="To date"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>
      )}

      {/* Entries */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            {isLoading ? 'Loading…' : `${pagination.total} entr${pagination.total === 1 ? 'y' : 'ies'}`}
            {meta?.totalEntries != null && !isLoading && (
              <span className="text-slate-400"> of {meta.totalEntries} recorded</span>
            )}
          </span>
          <button onClick={() => loadLogs(pagination.page)} className="text-xs font-semibold text-slate-500 hover:text-[#0a66c2] transition-colors">
            ↻ Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Reading transcript…</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-bold text-slate-700 text-sm">No entries match these filters</p>
            <p className="text-xs text-slate-500 mt-1">
              {activeCount > 0 ? 'Try clearing a filter.' : 'Use the app to generate some traffic, then refresh.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const open = expandedId === log.id;
              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedId(open ? null : log.id)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50/70 transition-colors text-left"
                  >
                    <span className="font-mono text-[11px] text-slate-500 w-[132px] shrink-0">
                      {log.time.slice(0, 10)} {log.time.slice(11, 19)}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-700 w-14 shrink-0">{log.method}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${statusTone(log.status)}`}>
                      {log.status}
                    </span>
                    <span className="font-mono text-[11px] text-slate-700 truncate flex-1 min-w-0">{log.path}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${roleTone(log.role)}`}>
                      {log.role}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 w-16 text-right shrink-0">{log.durationMs}ms</span>
                    <span className="text-slate-400 text-xs shrink-0">{open ? '▾' : '▸'}</span>
                  </button>

                  {open && (
                    <div className="px-5 pb-4">
                      <div className="flex flex-wrap gap-3 mb-2 text-[11px] text-slate-500">
                        <span>session <button onClick={() => setFilters((f) => ({ ...f, session: log.session }))} className="font-mono text-[#0a66c2] hover:underline">{log.session}</button></span>
                        <span>user <span className="font-mono">{log.userId}</span></span>
                        <span>ip <span className="font-mono">{log.ip}</span></span>
                        <span>file <span className="font-mono">{log.file}</span></span>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-[11px] leading-relaxed overflow-x-auto max-h-[460px] whitespace-pre-wrap break-words">
                        {log.detail}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => loadLogs(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                Previous
              </button>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => loadLogs(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
