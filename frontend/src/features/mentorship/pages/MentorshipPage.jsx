// frontend/src/features/mentorship/pages/MentorshipPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../../components/layout/Navbar';
import PageHeading from '../../../components/ui/PageHeading';
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeading
          eyebrow="Guidance & growth"
          title="Mentorship Program"
          description="Bridge academic life with real-world careers through 1-on-1 mentorship."
          actions={(
            <button onClick={() => setIsModalOpen(true)} className="page-action">
              Request mentorship
              <span aria-hidden="true">+</span>
            </button>
          )}
        />

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 mb-8 gap-6">
          <button
            onClick={() => setActiveTab('mentors')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'mentors'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>My Mentors (As Mentee)</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {asMentee.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('mentees')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'mentees'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>My Mentees (As Mentor)</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {asMentor.length}
            </span>
          </button>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading mentorships...</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <span className="text-4xl block">🎓</span>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'mentors'
                ? 'No active or pending mentors yet'
                : 'No mentees have requested guidance yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'mentors'
                ? 'Connect with experienced alumni in your career domain to receive personalized advice.'
                : 'Your profile is visible to students looking for mentorship.'}
            </p>
            {activeTab === 'mentors' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-block mt-2 px-5 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
              >
                Find an Alumni Mentor →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedList.map((item) => {
              const partner = item.partner;
              const isPending = item.status === 'PENDING';
              const isActive = item.status === 'ACTIVE';
              const isEnded = item.status === 'ENDED';
              const isActionLoading = actionLoadingId === item.id;
              const isUserMentor = item.role === 'MENTOR';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Top Status & Frequency */}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isPending
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : isEnded
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {item.status}
                      </span>

                      <span className="text-[11px] font-semibold text-slate-400 uppercase">
                        {item.frequency?.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Partner Header */}
                    <div className="mb-4">
                      <h3 className="font-bold text-slate-900 text-lg leading-snug">
                        {partner?.name || 'Partner'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {partner?.designation && partner?.company
                          ? `${partner.designation} at ${partner.company}`
                          : partner?.company || partner?.department || partner?.role}
                      </p>
                    </div>

                    {/* Focus Area */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-3 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Focus Area
                      </span>
                      <p className="text-xs font-semibold text-slate-800">
                        {item.focusArea}
                      </p>
                    </div>

                    {/* Goals / Help Description */}
                    {item.goals && (
                      <div className="mb-2">
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          Goals:
                        </span>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                          {item.goals}
                        </p>
                      </div>
                    )}

                    {item.helpDescription && (
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          Help Needed:
                        </span>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                          {item.helpDescription}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-5 mt-5 border-t border-slate-100 flex items-center gap-2">
                    {/* Mentor can accept/reject pending */}
                    {isPending && isUserMentor && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'ACTIVE')}
                          disabled={isActionLoading}
                          className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-semibold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                        >
                          {isActionLoading ? '...' : 'Accept Mentorship'}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'REJECTED')}
                          disabled={isActionLoading}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
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
                        className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {isActionLoading ? 'Cancelling...' : 'Cancel Request'}
                      </button>
                    )}

                    {/* Either party can end active mentorship */}
                    {isActive && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'ENDED')}
                        disabled={isActionLoading}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
                      >
                        {isActionLoading ? 'Ending...' : 'Complete Mentorship'}
                      </button>
                    )}

                    {/* Closed state */}
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
