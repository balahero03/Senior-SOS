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
    <div className="feed-card p-5 flex flex-col justify-between group hover:border-[#0a66c2]/40">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-base shadow-xs group-hover:ring-2 group-hover:ring-blue-300 transition-all">
            {initials}
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isAlumni
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
        <Link to={`/profile/${user.id}`} className="block group-hover:text-[#0a66c2] transition-colors">
          <h3 className="font-bold text-slate-900 text-sm leading-snug">{displayName}</h3>
        </Link>

        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
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
          <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
            {user.bio}
          </p>
        )}

        {/* Skills preview */}
        {user.skills && user.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {user.skills.slice(0, 3).map((s, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600"
              >
                {s.name}
              </span>
            ))}
            {user.skills.length > 3 && (
              <span className="text-[10px] text-slate-400 self-center">
                +{user.skills.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
        <Link
          to={`/profile/${user.id}`}
          className="text-xs font-bold text-slate-500 hover:text-[#0a66c2] transition-colors"
        >
          View Profile
        </Link>

        {status === 'SELF' ? (
          <span className="text-xs text-slate-400 font-medium">You</span>
        ) : status === 'CONNECTED' ? (
          <Link
            to="/messages"
            className="btn-linkedin-primary text-xs py-1 px-3"
          >
            Message
          </Link>
        ) : status === 'PENDING_SENT' ? (
          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">
            Pending
          </span>
        ) : status === 'PENDING_RECEIVED' ? (
          <Link
            to="/network"
            className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full"
          >
            Respond
          </Link>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="btn-linkedin-secondary text-xs py-1 px-3 disabled:opacity-50"
          >
            {loading ? '...' : '+ Connect'}
          </button>
        )}
      </div>
    </div>
  );
}
