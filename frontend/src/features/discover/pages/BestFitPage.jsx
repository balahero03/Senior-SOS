// frontend/src/features/discover/pages/BestFitPage.jsx
// "Who should I talk to?" — ranks verified alumni against the student's own
// skills, interests, department and network, and shows why each one was
// picked so the ranking is never a black box.

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar';
import useAuthStore from '../../../stores/authStore';
import {
  getAlumniMatches,
  getDepartments,
  getCompanies,
  sendConnectionRequest,
} from '../api';

// Starting points for a student who does not know what to search for.
const QUICK_INTERESTS = [
  'Backend Development',
  'Frontend Development',
  'Machine Learning',
  'Cloud and DevOps',
  'System Design',
  'Embedded Systems',
  'Product Management',
  'Higher Studies',
];

const REASON_STYLE = {
  skills: 'bg-blue-50 text-blue-700 border-blue-200',
  interests: 'bg-violet-50 text-violet-700 border-violet-200',
  network: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reachable: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  department: 'bg-amber-50 text-amber-700 border-amber-200',
  experience: 'bg-slate-50 text-slate-600 border-slate-200',
  recency: 'bg-slate-50 text-slate-600 border-slate-200',
  verified: 'bg-teal-50 text-teal-700 border-teal-200',
};

/** Colour the score by strength, so a weak match does not look authoritative. */
function scoreTone(score) {
  if (score >= 60) return { ring: 'text-emerald-600', bar: 'bg-emerald-500', label: 'Strong match' };
  if (score >= 40) return { ring: 'text-[#0a66c2]', bar: 'bg-[#0a66c2]', label: 'Good match' };
  return { ring: 'text-slate-500', bar: 'bg-slate-400', label: 'Possible match' };
}

function MatchCard({ item, onConnect, connectingId }) {
  const { user: alumnus, score, reasons } = item;
  const tone = scoreTone(score);
  const busy = connectingId === alumnus.id;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? reasons : reasons.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <Link to={`/profile/${alumnus.id}`} className="shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold">
            {(alumnus.name || 'A').charAt(0).toUpperCase()}
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/profile/${alumnus.id}`} className="font-bold text-slate-900 hover:text-[#0a66c2] block truncate">
                {alumnus.name}
              </Link>
              <p className="text-xs text-slate-600 truncate">
                {alumnus.designation || 'Alumnus'}
                {alumnus.company ? ` at ${alumnus.company}` : ''}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {alumnus.department || '—'}
                {alumnus.graduationYear ? ` • Class of ${alumnus.graduationYear}` : ''}
              </p>
            </div>

            {/* Score */}
            <div className="text-right shrink-0">
              <div className={`text-xl font-black ${tone.ring}`}>{score}%</div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {tone.label}
              </div>
            </div>
          </div>

          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${tone.bar} rounded-full transition-all`} style={{ width: `${Math.max(4, score)}%` }} />
          </div>

          {/* Why this person */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visible.map((r) => (
              <span
                key={`${r.type}-${r.label}`}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium ${REASON_STYLE[r.type] || REASON_STYLE.experience}`}
              >
                {r.label}
              </span>
            ))}
            {reasons.length > 3 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-[#0a66c2]"
              >
                {showAll ? 'show less' : `+${reasons.length - 3} more`}
              </button>
            )}
          </div>

          {/* The route is the actionable part: who can introduce you. */}
          {item.route && item.route.length > 2 && (
            <p className="mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Introduction path: </span>
              {item.route.map((n) => n.name).join(' → ')}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => onConnect(alumnus.id)}
              disabled={busy}
              className="px-4 py-1.5 rounded-xl bg-[#0a66c2] text-white text-xs font-bold hover:bg-[#004182] disabled:opacity-50 transition-colors"
            >
              {busy ? 'Sending…' : 'Connect'}
            </button>
            <Link
              to={`/profile/${alumnus.id}`}
              className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              View profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BestFitPage() {
  const { user } = useAuthStore();

  const [interest, setInterest] = useState('');
  const [submittedInterest, setSubmittedInterest] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [companyId, setCompanyId] = useState('');

  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectingId, setConnectingId] = useState(null);
  const [sentTo, setSentTo] = useState([]);

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {});
    getCompanies().then(setCompanies).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = { limit: 15 };
      if (submittedInterest.trim()) params.interest = submittedInterest.trim();
      if (departmentId) params.departmentId = departmentId;
      if (companyId) params.companyId = companyId;
      setData(await getAlumniMatches(params));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load recommendations.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [submittedInterest, departmentId, companyId]);

  useEffect(() => { load(); }, [load]);

  const handleConnect = async (id) => {
    setConnectingId(id);
    try {
      await sendConnectionRequest(id);
      setSentTo((prev) => [...prev, id]);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not send the request.');
    } finally {
      setConnectingId(null);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    setSubmittedInterest(interest);
  };

  const pickQuick = (value) => {
    setInterest(value);
    setSubmittedInterest(value);
  };

  const results = (data?.recommendations || []).filter((r) => !sentTo.includes(r.user.id));

  // Alumni and admins get a 403 from the API; explain rather than show an error.
  if (user && user.role !== 'STUDENT') {
    return (
      <div className="min-h-screen bg-[#f4f2ee] flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 text-[#0a66c2] flex items-center justify-center text-2xl mb-4">🎯</div>
            <h2 className="text-lg font-bold text-slate-800">Built for students</h2>
            <p className="text-sm text-slate-500 mt-2">
              Best-fit recommendations match a student&apos;s profile against alumni.
              As {user.role === 'ALUMNI' ? 'an alumnus' : 'an admin'}, browse the campus
              directory instead.
            </p>
            <Link to="/discover" className="inline-block mt-6 px-4 py-2 rounded-xl bg-[#0a66c2] text-white text-xs font-bold hover:bg-[#004182] transition-colors">
              Open Discover
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#004182] to-[#0a66c2] text-white rounded-2xl p-6 shadow-sm mb-5">
          <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/15 border border-white/20">
            Best fit
          </span>
          <h1 className="text-xl font-bold mt-2">Who should you talk to?</h1>
          <p className="text-sm text-blue-100/90 max-w-2xl mt-1">
            Verified alumni ranked against your skills, interests, department and
            shared connections. Every suggestion explains why it is here.
          </p>

          <form onSubmit={submit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="What do you want help with? e.g. machine learning, placements, backend"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white/95 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-white text-[#0a66c2] text-sm font-bold hover:bg-blue-50 transition-colors whitespace-nowrap">
              Find
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_INTERESTS.map((q) => (
              <button
                key={q}
                onClick={() => pickQuick(q)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  submittedInterest === q
                    ? 'bg-white text-[#0a66c2] border-white'
                    : 'bg-white/10 text-blue-50 border-white/25 hover:bg-white/20'
                }`}
              >
                {q}
              </button>
            ))}
            {submittedInterest && (
              <button
                onClick={() => { setInterest(''); setSubmittedInterest(''); }}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-blue-100 hover:text-white underline"
              >
                clear
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">Narrow by</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Any department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Any company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {(departmentId || companyId) && (
            <button
              onClick={() => { setDepartmentId(''); setCompanyId(''); }}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>
        )}

        {/* Profile nudge: scoring needs something to match against. */}
        {data && !data.profileComplete && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-bold text-amber-900">Add your skills and interests</p>
            <p className="text-xs text-amber-800 mt-1">
              Recommendations are matched against your profile. Without skills or
              career interests these are mostly generic.{' '}
              <Link to="/profile" className="font-bold underline">Update your profile</Link>
            </p>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-40" />
                    <div className="h-2 bg-slate-100 rounded w-56" />
                    <div className="h-1.5 bg-slate-100 rounded w-full mt-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mb-4">🔍</div>
            <h3 className="font-bold text-slate-800 text-sm">
              {data?.searchApplied ? `No alumni match "${submittedInterest}"` : 'No recommendations yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {data?.searchApplied
                ? 'Try a broader term, or clear the search to see your overall best fits.'
                : 'You may already be connected to everyone we would suggest, or there are no verified alumni matching your filters.'}
            </p>
            {data?.searchApplied && (
              <button
                onClick={() => { setInterest(''); setSubmittedInterest(''); }}
                className="mt-5 px-4 py-2 rounded-xl bg-[#0a66c2] text-white text-xs font-bold hover:bg-[#004182] transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              {results.length} {results.length === 1 ? 'alumnus' : 'alumni'}
              {submittedInterest ? ` for "${submittedInterest}"` : ' matched to your profile'}
              {data?.graphEnabled === false && ' · mutual connections unavailable'}
            </p>
            <div className="space-y-3">
              {results.map((item) => (
                <MatchCard
                  key={item.user.id}
                  item={item}
                  onConnect={handleConnect}
                  connectingId={connectingId}
                />
              ))}
            </div>
          </>
        )}

        {sentTo.length > 0 && (
          <p className="mt-4 text-xs text-emerald-700 font-semibold text-center">
            {sentTo.length} connection {sentTo.length === 1 ? 'request' : 'requests'} sent.{' '}
            <Link to="/network" className="underline">View your network</Link>
          </p>
        )}
      </main>
    </div>
  );
}
