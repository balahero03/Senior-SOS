// frontend/src/features/referrals/pages/ReferralsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../../components/layout/Navbar';
import PageHeading from '../../../components/ui/PageHeading';
import useAuthStore from '../../../stores/authStore';
import {
  getSentReferrals,
  getReceivedReferrals,
  updateReferralStatus,
} from '../api';
import RequestReferralModal from '../components/RequestReferralModal';

const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'REFERRED', 'INTERVIEW', 'COMPLETED'];

export default function ReferralsPage() {
  const { user } = useAuthStore();
  const isAlumni = user?.role === 'ALUMNI';

  const [activeTab, setActiveTab] = useState(isAlumni ? 'received' : 'sent'); // 'sent' | 'received'
  const [sentReferrals, setSentReferrals] = useState([]);
  const [receivedReferrals, setReceivedReferrals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchReferrals = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sent, rec] = await Promise.all([
        getSentReferrals().catch(() => []),
        isAlumni ? getReceivedReferrals().catch(() => []) : Promise.resolve([]),
      ]);
      setSentReferrals(sent || []);
      setReceivedReferrals(rec || []);
    } catch (err) {
      console.error('Failed to load referrals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAlumni]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleUpdateStatus = async (id, newStatus) => {
    const note = window.prompt(`Add a note for status update to ${newStatus} (optional):`);
    setActionLoadingId(id);
    try {
      await updateReferralStatus(id, newStatus, note);
      await fetchReferrals();
    } catch (err) {
      console.error('Update referral status failed:', err);
      alert(err.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const currentList = activeTab === 'sent' ? sentReferrals : receivedReferrals;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeading
          eyebrow="Career pipeline"
          title="Job Referrals Hub"
          description="Get referred to top companies by verified alumni working inside."
          actions={!isAlumni && (
            <button onClick={() => setIsModalOpen(true)} className="page-action">
              Request referral
              <span aria-hidden="true">+</span>
            </button>
          )}
        />

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 mb-8 gap-6">
          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
              activeTab === 'sent'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>My Sent Requests</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {sentReferrals.length}
            </span>
          </button>

          {isAlumni && (
            <button
              onClick={() => setActiveTab('received')}
              className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
                activeTab === 'received'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Received Requests</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                {receivedReferrals.length}
              </span>
            </button>
          )}
        </div>

        {/* Referral Cards */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading referrals...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <span className="text-4xl block">💼</span>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'sent' ? 'No referral requests submitted yet' : 'No incoming referral requests'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'sent'
                ? 'Reach out to alumni working at your dream tech companies for an internal employee referral.'
                : 'When students request referrals from you, they will appear here.'}
            </p>
            {activeTab === 'sent' && !isAlumni && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-block mt-2 px-5 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
              >
                Request a Referral →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentList.map((ref) => {
              const otherUser = activeTab === 'sent' ? ref.alumni : ref.student;
              const isActionLoading = actionLoadingId === ref.id;
              const isRejected = ref.status === 'REJECTED';
              const isCancelled = ref.status === 'CANCELLED';

              return (
                <div
                  key={ref.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Header badge & Company */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          ref.status === 'COMPLETED' || ref.status === 'INTERVIEW'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : ref.status === 'REFERRED'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : ref.status === 'ACCEPTED'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : isRejected || isCancelled
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {ref.status}
                      </span>

                      <span className="text-xs font-bold text-slate-700">
                        {ref.company?.name}
                      </span>
                    </div>

                    {/* Job Position Title */}
                    <h3 className="font-bold text-slate-900 text-lg leading-snug">
                      {ref.jobTitle}
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeTab === 'sent'
                        ? `Alumnus: ${otherUser?.name || 'Alumnus'}`
                        : `Applicant: ${otherUser?.name || 'Student'}`}
                    </p>

                    {/* Links */}
                    <div className="flex items-center gap-3 mt-3">
                      {ref.jobUrl && (
                        <a
                          href={ref.jobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          🔗 Job Link
                        </a>
                      )}
                      {ref.resumeUrl && (
                        <a
                          href={ref.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          📄 Resume
                        </a>
                      )}
                    </div>

                    {/* Pitch / Message */}
                    {ref.reason && (
                      <div className="mt-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600">
                        <span className="font-bold text-slate-500 block mb-0.5 text-[11px] uppercase">Pitch</span>
                        {ref.reason}
                      </div>
                    )}

                    {/* Status Pipeline Progress Indicator */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                        Pipeline Status
                      </span>
                      <div className="flex items-center gap-1">
                        {STATUS_STEPS.map((step, idx) => {
                          const currentIdx = STATUS_STEPS.indexOf(ref.status);
                          const isDone = currentIdx >= idx;
                          return (
                            <div
                              key={step}
                              title={step}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                isDone
                                  ? 'bg-blue-600'
                                  : isRejected || isCancelled
                                  ? 'bg-slate-200'
                                  : 'bg-slate-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Alumnus or Student Actions */}
                  <div className="pt-5 mt-5 border-t border-slate-100">
                    {/* Alumnus Controls */}
                    {activeTab === 'received' && (
                      <div className="space-y-2">
                        {ref.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(ref.id, 'ACCEPTED')}
                              disabled={isActionLoading}
                              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                            >
                              Accept Request
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(ref.id, 'REJECTED')}
                              disabled={isActionLoading}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        )}

                        {ref.status === 'ACCEPTED' && (
                          <button
                            onClick={() => handleUpdateStatus(ref.id, 'REFERRED')}
                            disabled={isActionLoading}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                          >
                            Mark as Submitted / Referred
                          </button>
                        )}

                        {ref.status === 'REFERRED' && (
                          <button
                            onClick={() => handleUpdateStatus(ref.id, 'INTERVIEW')}
                            disabled={isActionLoading}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                          >
                            Mark Interview Scheduled
                          </button>
                        )}

                        {ref.status === 'INTERVIEW' && (
                          <button
                            onClick={() => handleUpdateStatus(ref.id, 'COMPLETED')}
                            disabled={isActionLoading}
                            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                          >
                            Mark Completed / Hired
                          </button>
                        )}
                      </div>
                    )}

                    {/* Student cancel if pending */}
                    {activeTab === 'sent' && ref.status === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateStatus(ref.id, 'CANCELLED')}
                        disabled={isActionLoading}
                        className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <RequestReferralModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onReferralCreated={fetchReferrals}
      />
    </div>
  );
}
