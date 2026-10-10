// frontend/src/features/discover/components/MemberCard.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendConnectionRequest } from '../api';

export default function MemberCard({ user, onConnected }) {
  const [status, setStatus] = useState(user.connectionStatus);
  const [loading, setLoading] = useState(false);

  const handleConnect = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading || status !== 'NONE') return;

    setLoading(true);
    try {
      await sendConnectionRequest(user.id);
      setStatus('PENDING_SENT');
      if (onConnected) onConnected(user.id);
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayName = user.name || 'Member';
  const initials = displayName.charAt(0).toUpperCase();
  const isAlumni = user.role === 'ALUMNI';

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            {initials}
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isAlumni
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAlumni ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            {user.role}
          </span>
        </div>

        {/* Name & Title */}
        <Link to={`/profile/${user.id}`} className="block group-hover:text-blue-600 transition-colors">
          <h3 className="font-bold text-slate-900 text-lg leading-snug">{displayName}</h3>
        </Link>

        <p className="text-xs font-medium text-slate-500 mt-1">
          {isAlumni
            ? user.designation && user.company
              ? `${user.designation} at ${user.company}`
              : user.company || 'Alumnus'
            : user.departmentName || user.department || 'Student'}
        </p>

        {user.graduationYear && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            Class of {user.graduationYear}
          </p>
        )}

        {/* Bio excerpt */}
        {user.bio && (
          <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
            {user.bio}
          </p>
        )}

        {/* Skills preview */}
        {user.skills && user.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {user.skills.slice(0, 3).map((s, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-medium text-slate-600 border border-slate-200/60"
              >
                {s.name}
              </span>
            ))}
            {user.skills.length > 3 && (
              <span className="text-[10px] text-slate-400 self-center">
                +{user.skills.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-3">
        <Link
          to={`/profile/${user.id}`}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          View Profile →
        </Link>

        {status === 'SELF' ? (
          <span className="text-xs text-slate-400 font-medium">You</span>
        ) : status === 'CONNECTED' ? (
          <Link
            to="/messages"
            className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold rounded-xl transition-colors"
          >
            Message
          </Link>
        ) : status === 'PENDING_SENT' ? (
          <span className="px-3 py-1 bg-slate-100 text-slate-400 text-xs font-medium rounded-xl">
            Pending
          </span>
        ) : status === 'PENDING_RECEIVED' ? (
          <Link
            to="/dashboard"
            className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl"
          >
            Respond
          </Link>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            {loading ? '...' : '+ Connect'}
          </button>
        )}
      </div>
    </div>
  );
}
