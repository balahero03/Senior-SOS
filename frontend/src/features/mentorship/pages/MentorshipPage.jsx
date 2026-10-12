// frontend/src/features/mentorship/pages/MentorshipPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../../components/layout/Navbar';
import useAuthStore from '../../../stores/authStore';
import { getMyMentorships, updateMentorshipStatus } from '../api';
import RequestMentorshipModal from '../components/RequestMentorshipModal';

export default function MentorshipPage() {
  const { user } = useAuthStore();
  const [mentorships, setMentorships] = useState([]);
  const [activeTab, setActiveTab] = useState('mentors'); // 'mentors' (as Mentee) | 'mentees' (as Mentor)
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchMentorships = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMyMentorships();
      setMentorships(data || []);
    } catch (err) {
      console.error('Failed to load mentorships:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentorships();
  }, [fetchMentorships]);

  const handleUpdateStatus = async (id, status) => {
    setActionLoadingId(id);
    try {
      await updateMentorshipStatus(id, status);
      await fetchMentorships();
    } catch (err) {
      console.error('Update status failed:', err);
      alert(err.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const asMentee = mentorships.filter((m) => m.role === 'MENTEE');
  const asMentor = mentorships.filter((m) => m.role === 'MENTOR');

  const displayedList = activeTab === 'mentors' ? asMentee : asMentor;

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#0a66c2] uppercase tracking-wider">
              Guidance & Growth
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-1">Campus Mentorship Program</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              1-on-1 career guidance, mock interviews, and mentorship between alumni and students.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-linkedin-primary text-xs self-start sm:self-auto py-2 px-5"
          >
            + Request Mentorship
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 mb-6 gap-6 bg-white px-4 pt-2 rounded-t-xl border-x">
          <button
            onClick={() => setActiveTab('mentors')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'mentors'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>My Mentors (As Mentee)</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700">
              {asMentee.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('mentees')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'mentees'
                ? 'text-[#0a66c2] border-b-2 border-[#0a66c2]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>My Mentees (As Mentor)</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700">
              {asMentor.length}
            </span>
          </button>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-3 border-[#0a66c2] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading mentorships...</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="p-12 text-center feed-card space-y-3">
            <span className="text-4xl block">🎓</span>
            <h3 className="text-sm font-bold text-slate-800">
              {activeTab === 'mentors'
                ? 'No active or pending mentors yet'
                : 'No mentees have requested guidance yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'mentors'
                ? 'Connect with experienced alumni in your career domain to receive personalized guidance.'
                : 'Your profile is visible to students looking for mentorship.'}
            </p>
            {activeTab === 'mentors' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-linkedin-primary text-xs mt-2"
              >
                Find an Alumni Mentor →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedList.map((item) => {
              const partner = item.partner;
              const isPending = item.status === 'PENDING';
              const isActive = item.status === 'ACTIVE';
              const isEnded = item.status === 'ENDED';
              const isActionLoading = actionLoadingId === item.id;
              const isUserMentor = item.role === 'MENTOR';
              const initials = partner?.name ? partner.name.charAt(0).toUpperCase() : 'M';

              return (
                <div
                  key={item.id}
                  className="feed-card p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Status & Frequency */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isPending
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isEnded
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {item.status}
                      </span>

                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {item.frequency?.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Partner Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#0a66c2] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {partner?.name || 'Partner'}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          {partner?.designation && partner?.company
                            ? `${partner.designation} at ${partner.company}`
                            : partner?.company || partner?.department || partner?.role}
                        </p>
                      </div>
                    </div>

                    {/* Focus Area */}
                    <div className="bg-[#f8fafc] p-3 rounded-lg border border-slate-200 mb-3 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Focus Area
                      </span>
                      <p className="text-xs font-semibold text-slate-800">
                        {item.focusArea}
                      </p>
                    </div>

                    {/* Goals / Help Description */}
                    {item.goals && (
                      <div className="mb-2 text-xs">
                        <span className="text-[11px] font-bold text-slate-400 block">Goals:</span>
                        <p className="text-slate-600 line-clamp-2 mt-0.5">{item.goals}</p>
                      </div>
                    )}

                    {item.helpDescription && (
                      <div className="text-xs">
                        <span className="text-[11px] font-bold text-slate-400 block">Help Needed:</span>
                        <p className="text-slate-600 line-clamp-2 mt-0.5">{item.helpDescription}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
                    {/* Mentor can accept/reject pending */}
                    {isPending && isUserMentor && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'ACTIVE')}
                          disabled={isActionLoading}
                          className="btn-linkedin-primary text-xs flex-1 py-1.5"
                        >
                          {isActionLoading ? '...' : 'Accept Mentorship'}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'REJECTED')}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-full transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {/* Mentee can cancel pending */}
                    {isPending && !isUserMentor && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'CANCELLED')}
                        disabled={isActionLoading}
                        className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
                      >
                        {isActionLoading ? 'Cancelling...' : 'Cancel Request'}
                      </button>
                    )}

                    {/* Either party can end active mentorship */}
                    {isActive && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'ENDED')}
                        disabled={isActionLoading}
                        className="btn-linkedin-secondary text-xs w-full py-1.5"
                      >
                        {isActionLoading ? 'Ending...' : 'Complete Mentorship'}
                      </button>
                    )}

                    {!isPending && !isActive && (
                      <span className="text-xs text-slate-400 font-medium italic">
                        Session concluded
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <RequestMentorshipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onMentorshipCreated={fetchMentorships}
      />
    </div>
  );
}
